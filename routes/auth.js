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
    throw new BadRequest('Email is required')
  }

  return normalized
}

function ensureName(name) {
  const normalized = String(name || '').trim()
  if (!normalized) {
    throw new BadRequest('Name is required')
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
    throw new Conflict('Email is already registered')
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
      throw new Conflict('Email is already registered')
    }

    throw error
  }

  const refreshToken = await persistRefreshToken(user.id)
  setRefreshTokenCookie(res, refreshToken)

  success(res, 'Registered successfully', issueAuthPayload(user), 201)
})

router.post('/login', async (req, res) => {
  const email = ensureEmail(req.body.email)
  const password = String(req.body.password || '')
  const user = await db.User.findOne({ where: { email } })

  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new Unauthorized('Invalid email or password')
  }

  const refreshToken = await persistRefreshToken(user.id)
  setRefreshTokenCookie(res, refreshToken)

  success(res, 'Logged in successfully', issueAuthPayload(user))
})

router.post('/refresh', async (req, res) => {
  const token = req.cookies.refreshToken
  if (!token) {
    throw new Unauthorized('Refresh token is required')
  }

  const record = await db.RefreshToken.findActiveByTokenHash(hashRefreshToken(token))
  if (!record) {
    throw new Unauthorized('Refresh token is invalid')
  }

  await db.RefreshToken.revokeByTokenHash(record.tokenHash)

  const user = await db.User.findByPk(record.userId)
  if (!user) {
    throw new Unauthorized('Refresh token user not found')
  }

  const nextRefreshToken = await persistRefreshToken(user.id)
  setRefreshTokenCookie(res, nextRefreshToken)

  success(res, 'Token refreshed successfully', issueAuthPayload(user))
})

router.post('/logout', async (req, res) => {
  const token = req.cookies.refreshToken
  if (token) {
    await db.RefreshToken.revokeByTokenHash(hashRefreshToken(token))
  }

  clearRefreshTokenCookie(res)
  success(res, 'Logged out successfully')
})

export default router
