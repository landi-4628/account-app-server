import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { randomUUID } from 'node:crypto'

import app from '../app.js'
import db from '../models/index.js'
import { signAccessToken } from '../utils/auth-token.js'

const USER_1 = '61000000-0000-4000-8000-000000000001'
const USER_2 = '61000000-0000-4000-8000-000000000002'
const LEDGER_1 = '08000000-0000-4000-8000-000000000001'
const LEDGER_2 = '08000000-0000-4000-8000-000000000002'
const LEDGER_3 = '08000000-0000-4000-8000-000000000003'

async function startServer() {
  const server = http.createServer(app)
  await new Promise((resolve) => server.listen(0, resolve))

  return {
    server,
    baseUrl: `http://127.0.0.1:${server.address().port}`,
  }
}

function authHeaders(userId = USER_1, extra = {}) {
  return {
    authorization: `Bearer ${signAccessToken({ sub: userId, email: `${userId}@example.com` })}`,
    'content-type': 'application/json',
    ...extra,
  }
}

function installLedgerDbTestDoubles(t) {
  const state = {
    users: [
      {
        id: USER_1,
        email: 'owner-1@example.com',
        name: 'Owner 1',
        current_ledger_id: LEDGER_1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: USER_2,
        email: 'owner-2@example.com',
        name: 'Owner 2',
        current_ledger_id: LEDGER_3,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    ledgers: [
      {
        id: LEDGER_1,
        name: 'Home',
        client_id: 'ledger-home',
        owner_user_id: USER_1,
        base_currency: 'CNY',
        is_deleted: false,
        deleted_at: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: LEDGER_2,
        name: 'Travel',
        client_id: 'ledger-travel',
        owner_user_id: USER_1,
        base_currency: 'USD',
        is_deleted: false,
        deleted_at: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: LEDGER_3,
        name: 'Other',
        client_id: 'ledger-other',
        owner_user_id: USER_2,
        base_currency: 'EUR',
        is_deleted: false,
        deleted_at: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  }

  const originals = {
    user: {
      findByPk: db.User.findByPk,
      update: db.User.update,
      ensureCurrentLedger: db.User.ensureCurrentLedger,
      sanitize: db.User.sanitize,
    },
    ledger: {
      findAll: db.Ledger.findAll,
      findOne: db.Ledger.findOne,
      create: db.Ledger.create,
    },
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

    if (Object.prototype.hasOwnProperty.call(values, 'current_ledger_id')) {
      user.current_ledger_id = values.current_ledger_id
    }

    if (Object.prototype.hasOwnProperty.call(values, 'currentLedgerId')) {
      user.current_ledger_id = values.currentLedgerId
    }

    user.updatedAt = new Date()
    return [1]
  }

  db.User.ensureCurrentLedger = async (user) => user

  db.User.sanitize = (user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    currentLedgerId: user.current_ledger_id ?? user.currentLedgerId ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  })

  db.Ledger.findAll = async ({ where, order } = {}) => {
    assert.deepEqual(order, [['createdAt', 'ASC'], ['id', 'ASC']])

    return state.ledgers
      .filter((ledger) => {
        if (where?.owner_user_id && ledger.owner_user_id !== where.owner_user_id) {
          return false
        }
        if (Object.prototype.hasOwnProperty.call(where || {}, 'is_deleted')) {
          return ledger.is_deleted === where.is_deleted
        }
        return true
      })
      .map((ledger) => ({ ...ledger }))
  }

  db.Ledger.findOne = async ({ where } = {}) => {
    const ledger = state.ledgers.find((entry) => {
      if (where?.id && entry.id !== where.id) {
        return false
      }
      if (where?.owner_user_id && entry.owner_user_id !== where.owner_user_id) {
        return false
      }
      if (Object.prototype.hasOwnProperty.call(where || {}, 'is_deleted')) {
        return entry.is_deleted === where.is_deleted
      }
      return true
    })

    return ledger ? { ...ledger } : null
  }

  db.Ledger.create = async (values) => {
    const ledger = {
      id: randomUUID(),
      name: values.name,
      client_id: values.client_id ?? `ledger:${randomUUID()}`,
      owner_user_id: values.owner_user_id,
      base_currency: values.base_currency ?? 'CNY',
      is_deleted: false,
      deleted_at: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    state.ledgers.push(ledger)
    return { ...ledger }
  }

  t.after(() => {
    Object.assign(db.User, originals.user)
    Object.assign(db.Ledger, originals.ledger)
  })

  return state
}

test('GET /ledgers lists only the authenticated user ledgers', async (t) => {
  installLedgerDbTestDoubles(t)
  const { server, baseUrl } = await startServer()
  t.after(() => server.close())

  const response = await fetch(`${baseUrl}/ledgers`, {
    headers: authHeaders(),
  })
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.data.currentLedgerId, LEDGER_1)
  assert.deepEqual(
    body.data.ledgers.map((ledger) => ledger.id),
    [LEDGER_1, LEDGER_2],
  )
})

test('POST /ledgers creates a user-owned ledger and selects it by default', async (t) => {
  const state = installLedgerDbTestDoubles(t)
  const { server, baseUrl } = await startServer()
  t.after(() => server.close())

  const response = await fetch(`${baseUrl}/ledgers`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      name: 'Business',
      base_currency: 'USD',
    }),
  })
  const body = await response.json()

  assert.equal(response.status, 201)
  assert.equal(body.data.ledger.owner_user_id, USER_1)
  assert.equal(body.data.ledger.base_currency, 'USD')
  assert.equal(body.data.currentLedgerId, body.data.ledger.id)
  assert.equal(state.users[0].current_ledger_id, body.data.ledger.id)
})

test('POST /ledgers/:id/select rejects selecting another user ledger', async (t) => {
  const state = installLedgerDbTestDoubles(t)
  const { server, baseUrl } = await startServer()
  t.after(() => server.close())

  const response = await fetch(`${baseUrl}/ledgers/${LEDGER_3}/select`, {
    method: 'POST',
    headers: authHeaders(),
  })
  const body = await response.json()

  assert.equal(response.status, 404)
  assert.equal(state.users[0].current_ledger_id, LEDGER_1)
  assert.equal(body.status, false)
})
