import createError from 'http-errors'
import express from 'express'

import db from '../models/index.js'
import requireAuth from '../middlewares/auth.js'
import { hashPassword, verifyPassword } from '../utils/auth-password.js'
import { success } from '../utils/responses.js'

const router = express.Router()
const { BadRequest, Conflict, Unauthorized } = createError

router.use(requireAuth)

router.get('/', async (req, res) => {
  success(res, 'Current user loaded successfully', {
    user: db.User.sanitize(req.user),
  })
})

router.patch('/', async (req, res) => {
  const updates = {}

  if (typeof req.body.name === 'string') {
    const name = req.body.name.trim()
    if (!name) {
      throw new BadRequest('Name cannot be empty')
    }

    updates.name = name
  }

  if (typeof req.body.email === 'string') {
    const email = req.body.email.trim().toLowerCase()
    if (!email) {
      throw new BadRequest('Email cannot be empty')
    }

    const existingUser = await db.User.findOne({ where: { email } })
    if (existingUser && existingUser.id !== req.user.id) {
      throw new Conflict('Email is already registered')
    }

    updates.email = email
  }

  const user = await db.User.updateProfile(req.user.id, updates)

  success(res, 'Profile updated successfully', {
    user: db.User.sanitize(user),
  })
})

router.post('/change-password', async (req, res) => {
  const currentPassword = String(req.body.currentPassword || '')
  const newPassword = String(req.body.newPassword || '')

  if (!verifyPassword(currentPassword, req.user.passwordHash)) {
    throw new Unauthorized('Current password is incorrect')
  }

  const passwordHash = hashPassword(newPassword)
  await db.User.updatePassword(req.user.id, passwordHash)
  await db.RefreshToken.revokeAllForUser(req.user.id)

  success(res, 'Password changed successfully')
})

export default router
