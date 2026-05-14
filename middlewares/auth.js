import createError from 'http-errors'

import db from '../models/index.js'
import { verifyAccessToken } from '../utils/auth-token.js'

const { Unauthorized } = createError

export default async function requireAuth(req, res, next) {
  try {
    const header = req.get('authorization') || ''
    const [scheme, token] = header.split(' ')

    if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
      throw new Unauthorized('请先登录（需要提供 Bearer 访问令牌）')
    }

    const payload = verifyAccessToken(token)
    let user = await db.User.findByPk(payload.sub)

    if (!user) {
      throw new Unauthorized('登录已失效，请重新登录')
    }

    user = await db.User.ensureCurrentLedger(user)

    req.auth = payload
    req.user = user
    next()
  } catch (error) {
    next(error.status ? error : new Unauthorized(error.message))
  }
}
