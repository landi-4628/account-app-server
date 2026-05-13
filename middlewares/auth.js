import createError from 'http-errors'

import db from '../models/index.js'
import { verifyAccessToken } from '../utils/auth-token.js'

const { Unauthorized } = createError

export default async function requireAuth(req, res, next) {
  try {
    const header = req.get('authorization') || ''
    const [scheme, token] = header.split(' ')

    if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
      throw new Unauthorized('Authentication required')
    }

    const payload = verifyAccessToken(token)
    const user = await db.User.findByPk(payload.sub)

    if (!user) {
      throw new Unauthorized('Authenticated user not found')
    }

    req.auth = payload
    req.user = user
    next()
  } catch (error) {
    next(error.status ? error : new Unauthorized(error.message))
  }
}
