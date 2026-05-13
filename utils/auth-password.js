import crypto from 'node:crypto'

const KEY_LENGTH = 64

function assertPasswordShape(password) {
  if (typeof password !== 'string' || password.length < 8) {
    throw new Error('Password must be at least 8 characters long')
  }
}

function hashPassword(password) {
  assertPasswordShape(password)

  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, KEY_LENGTH).toString('hex')

  return `${salt}:${hash}`
}

function verifyPassword(password, passwordHash) {
  if (typeof password !== 'string' || typeof passwordHash !== 'string') {
    return false
  }

  const [salt, storedHash] = passwordHash.split(':')
  if (!salt || !storedHash) {
    return false
  }

  const candidate = crypto.scryptSync(password, salt, KEY_LENGTH).toString('hex')
  const stored = Buffer.from(storedHash, 'hex')
  const actual = Buffer.from(candidate, 'hex')

  return stored.length === actual.length && crypto.timingSafeEqual(stored, actual)
}

export { hashPassword, verifyPassword }
