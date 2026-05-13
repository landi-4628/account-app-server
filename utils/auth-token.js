import crypto from 'node:crypto'

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000

function base64url(input) {
  return Buffer.from(input).toString('base64url')
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function getAccessTokenSecret() {
  if (process.env.AUTH_ACCESS_TOKEN_SECRET) {
    return process.env.AUTH_ACCESS_TOKEN_SECRET
  }

  if ((process.env.NODE_ENV || 'development') === 'production') {
    throw new Error('生产环境必须在环境变量中配置 AUTH_ACCESS_TOKEN_SECRET')
  }

  return 'dev-access-secret'
}

function signAccessToken(payload) {
  const body = {
    sub: String(payload.sub),
    email: payload.email,
    exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS,
  }
  const encodedPayload = base64url(JSON.stringify(body))
  const signature = crypto
    .createHmac('sha256', getAccessTokenSecret())
    .update(encodedPayload)
    .digest('base64url')

  return `${encodedPayload}.${signature}`
}

function verifyAccessToken(token) {
  if (typeof token !== 'string') {
    throw new Error('缺少访问令牌')
  }

  const [encodedPayload, signature] = token.split('.')
  if (!encodedPayload || !signature) {
    throw new Error('访问令牌格式不正确')
  }

  const expected = crypto
    .createHmac('sha256', getAccessTokenSecret())
    .update(encodedPayload)
    .digest('base64url')

  if (expected !== signature) {
    throw new Error('访问令牌签名校验失败')
  }

  const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'))
  if (payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new Error('访问令牌已过期')
  }

  return payload
}

function createRefreshToken() {
  const token = crypto.randomBytes(32).toString('base64url')

  return {
    token,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  }
}

function hashRefreshToken(token) {
  return sha256(token)
}

export { createRefreshToken, hashRefreshToken, signAccessToken, verifyAccessToken }
