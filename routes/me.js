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
  success(res, '已获取当前用户信息', {
    user: db.User.sanitize(req.user),
  })
})

router.patch('/', async (req, res) => {
  const updates = {}

  if (typeof req.body.name === 'string') {
    const name = req.body.name.trim()
    if (!name) {
      throw new BadRequest('姓名不能为空')
    }

    updates.name = name
  }

  if (typeof req.body.email === 'string') {
    const email = req.body.email.trim().toLowerCase()
    if (!email) {
      throw new BadRequest('邮箱不能为空')
    }

    const existingUser = await db.User.findOne({ where: { email } })
    if (existingUser && existingUser.id !== req.user.id) {
      throw new Conflict('该邮箱已被其他账号使用')
    }

    updates.email = email
  }

  const user = await db.User.updateProfile(req.user.id, updates)

  success(res, '资料已更新', {
    user: db.User.sanitize(user),
  })
})

router.post('/change-password', async (req, res) => {
  const currentPassword = String(req.body.currentPassword || '')
  const newPassword = String(req.body.newPassword || '')

  if (!verifyPassword(currentPassword, req.user.passwordHash)) {
    throw new Unauthorized('当前密码不正确')
  }

  const passwordHash = hashPassword(newPassword)
  await db.User.updatePassword(req.user.id, passwordHash)
  await db.RefreshToken.revokeAllForUser(req.user.id)

  success(res, '密码已修改')
})

export default router
