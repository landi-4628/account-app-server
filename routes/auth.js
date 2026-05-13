import createError from 'http-errors'
import express from 'express'
import { UniqueConstraintError } from 'sequelize'

import db from '../models/index.js'
import { hashPassword, verifyPassword } from '../utils/auth-password.js'
import {
  createRefreshToken,
  hashRefreshToken,
  signAccessToken,
} from '../utils/auth-token.js'
import { success } from '../utils/responses.js'

const router = express.Router()
const { BadRequest, Conflict, Unauthorized } = createError

function ensureEmail(email) {
  const normalized = String(email || '').trim().toLowerCase()
  if (!normalized) {
    throw new BadRequest('请填写邮箱')
  }

  return normalized
}

function ensureName(name) {
  const normalized = String(name || '').trim()
  if (!normalized) {
    throw new BadRequest('请填写姓名')
  }

  return normalized
}

function issueAuthPayload(user) {
  return {
    user: db.User.sanitize(user),
    tokens: {
      accessToken: signAccessToken({ sub: user.id, email: user.email }),
    },
  }
}

async function persistRefreshToken(userId) {
  const refreshToken = createRefreshToken()

  await db.RefreshToken.create({
    userId,
    tokenHash: refreshToken.tokenHash,
    expiresAt: refreshToken.expiresAt,
  })

  return refreshToken.token
}

function setRefreshTokenCookie(res, token) {
  const forwardedProto = res.req?.get?.('x-forwarded-proto')

  res.cookie('refreshToken', token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: res.req?.secure || forwardedProto === 'https',
  })
}

function clearRefreshTokenCookie(res) {
  const forwardedProto = res.req?.get?.('x-forwarded-proto')

  res.clearCookie('refreshToken', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: res.req?.secure || forwardedProto === 'https',
  })
}

router.post('/register', async (req, res) => {
  const email = ensureEmail(req.body.email)
  const name = ensureName(req.body.name)
  const passwordHash = hashPassword(req.body.password)
  const existingUser = await db.User.findOne({ where: { email } })

  if (existingUser) {
    throw new Conflict('该邮箱已被注册')
  }

  let user
  try {
    user = await db.User.create({
      email,
      name,
      passwordHash,
    })
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      throw new Conflict('该邮箱已被注册')
    }

    throw error
  }

  const refreshToken = await persistRefreshToken(user.id)
  setRefreshTokenCookie(res, refreshToken)

  success(res, '注册成功', issueAuthPayload(user), 201)
})

router.post('/login', async (req, res) => {
  const email = ensureEmail(req.body.email)
  const password = String(req.body.password || '')
  const user = await db.User.findOne({ where: { email } })

  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new Unauthorized('邮箱或密码不正确')
  }

  const refreshToken = await persistRefreshToken(user.id)
  setRefreshTokenCookie(res, refreshToken)

  success(res, '登录成功', issueAuthPayload(user))
})

router.post('/refresh', async (req, res) => {
  const token = req.cookies.refreshToken
  if (!token) {
    throw new Unauthorized('缺少刷新令牌，请重新登录')
  }

  const record = await db.RefreshToken.findActiveByTokenHash(hashRefreshToken(token))
  if (!record) {
    throw new Unauthorized('刷新令牌无效或已失效，请重新登录')
  }

  await db.RefreshToken.revokeByTokenHash(record.tokenHash)

  const user = await db.User.findByPk(record.userId)
  if (!user) {
    throw new Unauthorized('刷新令牌对应的用户不存在')
  }

  const nextRefreshToken = await persistRefreshToken(user.id)
  setRefreshTokenCookie(res, nextRefreshToken)

  success(res, '令牌刷新成功', issueAuthPayload(user))
})

router.post('/logout', async (req, res) => {
  const token = req.cookies.refreshToken
  if (token) {
    await db.RefreshToken.revokeByTokenHash(hashRefreshToken(token))
  }

  clearRefreshTokenCookie(res)
  success(res, '已退出登录')
})

export default router
