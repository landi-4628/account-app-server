import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { randomUUID } from 'node:crypto'

import app from '../app.js'
import db from '../models/index.js'
import { hashPassword } from '../utils/auth-password.js'
import { signAccessToken } from '../utils/auth-token.js'

async function startServer() {
  const server = http.createServer(app)
  await new Promise((resolve) => server.listen(0, resolve))

  return {
    server,
    baseUrl: `http://127.0.0.1:${server.address().port}`,
  }
}

function parseJson(response) {
  return response.json()
}

function readSetCookie(response, name) {
  return response.headers.getSetCookie().find((value) => value.startsWith(`${name}=`)) || null
}

function readCookie(response, name) {
  const cookie = readSetCookie(response, name)
  return cookie ? cookie.split(';', 1)[0] : null
}

function installAuthDbTestDoubles(t) {
  const state = {
    users: [],
    refreshTokens: [],
    ledgers: [],
  }

  const originals = {
    user: {
      create: db.User.create,
      findOne: db.User.findOne,
      findByPk: db.User.findByPk,
      update: db.User.update,
      sanitize: db.User.sanitize,
    },
    ledger: {
      findOrCreate: db.Ledger.findOrCreate,
    },
    refreshToken: {
      create: db.RefreshToken.create,
      findActiveByTokenHash: db.RefreshToken.findActiveByTokenHash,
      revokeByTokenHash: db.RefreshToken.revokeByTokenHash,
      revokeAllForUser: db.RefreshToken.revokeAllForUser,
    },
  }

  db.User.create = async (values) => {
    const email = String(values.email || '').trim().toLowerCase()
    if (state.users.some((user) => user.email === email)) {
      const error = new Error('email must be unique')
      error.name = 'SequelizeUniqueConstraintError'
      throw error
    }

    const now = new Date()
    const user = {
      id: randomUUID(),
      email,
      name: String(values.name || '').trim(),
      passwordHash: values.passwordHash,
      current_ledger_id: values.current_ledger_id ?? values.currentLedgerId ?? null,
      createdAt: now,
      updatedAt: now,
    }

    state.users.push(user)
    return { ...user }
  }

  db.User.findOne = async ({ where } = {}) => {
    const email = String(where?.email || '').trim().toLowerCase()
    const user = state.users.find((entry) => entry.email === email)
    return user ? { ...user } : null
  }

  db.User.findByPk = async (id) => {
    const user = state.users.find((entry) => entry.id === id)
    return user ? { ...user } : null
  }

  db.User.update = async (values, { where } = {}) => {
    const user = state.users.find((entry) => entry.id === where?.id)
    if (!user) {
      return [0]
    }

    if (typeof values.email === 'string') {
      const email = values.email.trim().toLowerCase()
      const duplicate = state.users.find((entry) => entry.email === email && entry.id !== user.id)
      if (duplicate) {
        const error = new Error('email must be unique')
        error.name = 'SequelizeUniqueConstraintError'
        throw error
      }

      user.email = email
    }

    if (typeof values.name === 'string') {
      user.name = values.name.trim()
    }

    if (typeof values.passwordHash === 'string') {
      user.passwordHash = values.passwordHash
    }

    if (Object.prototype.hasOwnProperty.call(values, 'current_ledger_id')) {
      user.current_ledger_id = values.current_ledger_id
    }

    if (Object.prototype.hasOwnProperty.call(values, 'currentLedgerId')) {
      user.current_ledger_id = values.currentLedgerId
    }

    user.updatedAt = new Date()
    return [1]
  }

  db.User.sanitize = (user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    currentLedgerId: user.current_ledger_id ?? user.currentLedgerId ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  })

  db.Ledger.findOrCreate = async ({ where, defaults } = {}) => {
    const clientId = where?.client_id ?? defaults?.client_id ?? null
    const existing = state.ledgers.find((ledger) => ledger.client_id === clientId)
    if (existing) {
      return [{ ...existing }, false]
    }

    const now = new Date()
    const ledger = {
      id: randomUUID(),
      name: defaults?.name ?? 'Personal Ledger',
      client_id: clientId,
      base_currency: defaults?.base_currency ?? 'CNY',
      is_deleted: false,
      deleted_at: null,
      createdAt: now,
      updatedAt: now,
    }

    state.ledgers.push(ledger)
    return [{ ...ledger }, true]
  }

  db.RefreshToken.create = async (values) => {
    const record = {
      id: randomUUID(),
      userId: String(values.userId),
      tokenHash: values.tokenHash,
      expiresAt: values.expiresAt,
      revokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    state.refreshTokens.push(record)
    return { ...record }
  }

  db.RefreshToken.findActiveByTokenHash = async (tokenHash) => {
    const record = state.refreshTokens.find(
      (entry) =>
        entry.tokenHash === tokenHash &&
        !entry.revokedAt &&
        entry.expiresAt.getTime() > Date.now(),
    )

    return record ? { ...record } : null
  }

  db.RefreshToken.revokeByTokenHash = async (tokenHash) => {
    for (const record of state.refreshTokens) {
      if (record.tokenHash === tokenHash && !record.revokedAt) {
        record.revokedAt = new Date()
        record.updatedAt = new Date()
      }
    }
  }

  db.RefreshToken.revokeAllForUser = async (userId) => {
    for (const record of state.refreshTokens) {
      if (record.userId === userId && !record.revokedAt) {
        record.revokedAt = new Date()
        record.updatedAt = new Date()
      }
    }
  }

  t.after(() => {
    Object.assign(db.User, originals.user)
    Object.assign(db.Ledger, originals.ledger)
    Object.assign(db.RefreshToken, originals.refreshToken)
  })

  return state
}

test('signAccessToken refuses implicit secrets outside development and test', () => {
  const originalEnv = process.env.NODE_ENV
  const originalSecret = process.env.AUTH_ACCESS_TOKEN_SECRET

  process.env.NODE_ENV = 'production'
  delete process.env.AUTH_ACCESS_TOKEN_SECRET

  assert.throws(() => signAccessToken({ sub: 1, email: 'guard@example.com' }), {
    message: /AUTH_ACCESS_TOKEN_SECRET/,
  })

  process.env.NODE_ENV = originalEnv
  if (originalSecret === undefined) {
    delete process.env.AUTH_ACCESS_TOKEN_SECRET
  } else {
    process.env.AUTH_ACCESS_TOKEN_SECRET = originalSecret
  }
})

test('register creates a user, returns profile data, and sets refresh cookie', async (t) => {
  installAuthDbTestDoubles(t)
  const { server, baseUrl } = await startServer()
  t.after(() => server.close())

  const response = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: 'worker-a@example.com',
      password: 'StrongPass123',
      name: 'Worker A',
    }),
  })

  const payload = await parseJson(response)

  assert.equal(response.status, 201)
  assert.equal(payload.status, true)
  assert.equal(payload.data.user.email, 'worker-a@example.com')
  assert.equal(payload.data.user.name, 'Worker A')
  assert.match(payload.data.user.currentLedgerId, /^[0-9a-f-]{36}$/i)
  assert.ok(payload.data.tokens.accessToken)
  assert.match(readCookie(response, 'refreshToken'), /^refreshToken=/)
})

test('refresh-token cookie includes centralized secure attributes for https requests', async (t) => {
  installAuthDbTestDoubles(t)
  const { server, baseUrl } = await startServer()
  t.after(() => server.close())

  const response = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-proto': 'https',
    },
    body: JSON.stringify({
      email: 'secure@example.com',
      password: 'StrongPass123',
      name: 'Secure User',
    }),
  })

  const cookie = readSetCookie(response, 'refreshToken')

  assert.ok(cookie)
  assert.match(cookie, /HttpOnly/i)
  assert.match(cookie, /SameSite=Lax/i)
  assert.match(cookie, /Secure/i)
})

test('login rejects invalid credentials and then returns new tokens for valid credentials', async (t) => {
  const state = installAuthDbTestDoubles(t)
  const { server, baseUrl } = await startServer()
  t.after(() => server.close())

  state.users.push({
    id: randomUUID(),
    email: 'login@example.com',
    name: 'Login User',
    passwordHash: hashPassword('StrongPass123'),
    current_ledger_id: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  const denied = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: 'login@example.com',
      password: 'wrong-password',
    }),
  })

  assert.equal(denied.status, 401)

  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: 'login@example.com',
      password: 'StrongPass123',
    }),
  })

  const payload = await parseJson(response)

  assert.equal(response.status, 200)
  assert.equal(payload.status, true)
  assert.equal(payload.data.user.email, 'login@example.com')
  assert.match(payload.data.user.currentLedgerId, /^[0-9a-f-]{36}$/i)
  assert.ok(payload.data.tokens.accessToken)
  assert.match(readCookie(response, 'refreshToken'), /^refreshToken=/)
})

test('refresh rotates the refresh cookie and logout revokes it', async (t) => {
  installAuthDbTestDoubles(t)
  const { server, baseUrl } = await startServer()
  t.after(() => server.close())

  const register = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: 'refresh@example.com',
      password: 'StrongPass123',
      name: 'Refresh User',
    }),
  })

  const cookie = readCookie(register, 'refreshToken')
  assert.ok(cookie)

  const refreshed = await fetch(`${baseUrl}/auth/refresh`, {
    method: 'POST',
    headers: { cookie },
  })

  const refreshedPayload = await parseJson(refreshed)
  const rotatedCookie = readCookie(refreshed, 'refreshToken')

  assert.equal(refreshed.status, 200)
  assert.ok(refreshedPayload.data.tokens.accessToken)
  assert.ok(rotatedCookie)
  assert.notEqual(rotatedCookie, cookie)

  const logout = await fetch(`${baseUrl}/auth/logout`, {
    method: 'POST',
    headers: { cookie: rotatedCookie },
  })

  assert.equal(logout.status, 200)

  const denied = await fetch(`${baseUrl}/auth/refresh`, {
    method: 'POST',
    headers: { cookie: rotatedCookie },
  })

  assert.equal(denied.status, 401)
})
