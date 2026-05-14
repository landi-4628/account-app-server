import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { randomUUID } from 'node:crypto'

import app from '../app.js'
import db from '../models/index.js'

async function startServer() {
  const server = http.createServer(app)
  await new Promise((resolve) => server.listen(0, resolve))

  return {
    server,
    baseUrl: `http://127.0.0.1:${server.address().port}`,
  }
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
      currentLedgerId: values.currentLedgerId ?? null,
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
      owner_user_id: defaults?.owner_user_id ?? null,
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
}

async function registerAndLogin(baseUrl) {
  const response = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: 'me@example.com',
      password: 'StrongPass123',
      name: 'Profile User',
    }),
  })

  const payload = await response.json()

  return {
    accessToken: payload.data.tokens.accessToken,
    refreshCookie: response.headers.getSetCookie().find((value) => value.startsWith('refreshToken=')),
  }
}

function authHeaders(accessToken, extra = {}) {
  return {
    authorization: `Bearer ${accessToken}`,
    'content-type': 'application/json',
    ...extra,
  }
}

test('me endpoints require auth and return the current profile', async (t) => {
  installAuthDbTestDoubles(t)
  const { server, baseUrl } = await startServer()
  t.after(() => server.close())

  const unauthorized = await fetch(`${baseUrl}/me`)
  assert.equal(unauthorized.status, 401)

  const session = await registerAndLogin(baseUrl)
  const response = await fetch(`${baseUrl}/me`, {
    headers: authHeaders(session.accessToken),
  })
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.equal(payload.data.user.email, 'me@example.com')
  assert.equal(payload.data.user.name, 'Profile User')
})

test('GET /me always returns a fresh JSON body for authenticated clients', async (t) => {
  installAuthDbTestDoubles(t)
  const currentLedgerId = randomUUID()
  const originalFindByPk = db.User.findByPk
  db.User.findByPk = async (id) => {
    const user = await originalFindByPk(id)
    return user ? { ...user, current_ledger_id: currentLedgerId } : null
  }

  const { server, baseUrl } = await startServer()
  t.after(() => server.close())

  const session = await registerAndLogin(baseUrl)
  const firstResponse = await fetch(`${baseUrl}/me`, {
    headers: authHeaders(session.accessToken),
  })
  const firstPayload = await firstResponse.json()
  const etag = firstResponse.headers.get('etag')

  assert.equal(firstResponse.status, 200)
  assert.equal(firstPayload.data.user.currentLedgerId, currentLedgerId)
  assert.equal(firstResponse.headers.get('cache-control'), 'no-store')
  assert.ok(etag)

  const secondResponse = await fetch(`${baseUrl}/me`, {
    headers: authHeaders(session.accessToken, {
      'if-none-match': etag,
    }),
  })
  const secondPayload = await secondResponse.json()

  assert.equal(secondResponse.status, 200)
  assert.equal(secondPayload.data.user.currentLedgerId, currentLedgerId)
})

test('profile write endpoints reject unauthenticated requests', async (t) => {
  installAuthDbTestDoubles(t)
  const { server, baseUrl } = await startServer()
  t.after(() => server.close())

  const patchResponse = await fetch(`${baseUrl}/me`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Nope' }),
  })

  const passwordResponse = await fetch(`${baseUrl}/me/change-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      currentPassword: 'StrongPass123',
      newPassword: 'EvenStronger456',
    }),
  })

  assert.equal(patchResponse.status, 401)
  assert.equal(passwordResponse.status, 401)
})

test('profile update accepts a case-insensitive bearer scheme', async (t) => {
  installAuthDbTestDoubles(t)
  const { server, baseUrl } = await startServer()
  t.after(() => server.close())

  const session = await registerAndLogin(baseUrl)
  const response = await fetch(`${baseUrl}/me`, {
    method: 'PATCH',
    headers: {
      authorization: `bearer ${session.accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Updated User',
      email: 'updated@example.com',
    }),
  })

  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.equal(payload.data.user.name, 'Updated User')
  assert.equal(payload.data.user.email, 'updated@example.com')
})

test('change password revokes existing refresh tokens and preserves authenticated access token session', async (t) => {
  installAuthDbTestDoubles(t)
  const { server, baseUrl } = await startServer()
  t.after(() => server.close())

  const session = await registerAndLogin(baseUrl)
  const response = await fetch(`${baseUrl}/me/change-password`, {
    method: 'POST',
    headers: authHeaders(session.accessToken),
    body: JSON.stringify({
      currentPassword: 'StrongPass123',
      newPassword: 'EvenStronger456',
    }),
  })

  assert.equal(response.status, 200)

  const revokedRefresh = await fetch(`${baseUrl}/auth/refresh`, {
    method: 'POST',
    headers: { cookie: session.refreshCookie },
  })
  assert.equal(revokedRefresh.status, 401)

  const oldLogin = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: 'me@example.com',
      password: 'StrongPass123',
    }),
  })
  assert.equal(oldLogin.status, 401)

  const newLogin = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: 'me@example.com',
      password: 'EvenStronger456',
    }),
  })
  assert.equal(newLogin.status, 200)

  const meResponse = await fetch(`${baseUrl}/me`, {
    headers: authHeaders(session.accessToken),
  })
  assert.equal(meResponse.status, 200)
})
