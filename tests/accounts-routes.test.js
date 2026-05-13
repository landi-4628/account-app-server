import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'

import app from '../app.js'
import db from '../models/index.js'
import { signAccessToken } from '../utils/auth-token.js'

const { Account } = db

const USER_41 = '41000000-0000-4000-8000-000000000041'
const LEDGER_12 = '12000000-0000-4000-8000-000000000012'
const LEDGER_33 = '33000000-0000-4000-8000-000000000033'
const ACCOUNT_1 = 'a0000001-0000-4000-8000-000000000001'
const ACCOUNT_4 = 'a0000004-0000-4000-8000-000000000004'

const authHeader = {
  authorization: `Bearer ${signAccessToken({ sub: USER_41, email: 'ledger@example.com' })}`,
}

test('GET /api/accounts lists accounts for the current ledger', async (t) => {
  const originalFindAll = Account?.findAll
  const originalUserFindByPk = db.User.findByPk

  Account.findAll = async (options) => {
    assert.deepEqual(options, {
      where: {
        ledger_id: LEDGER_12,
        is_deleted: false,
      },
      order: [['id', 'ASC']],
    })

    return [
      {
        id: ACCOUNT_1,
        ledger_id: LEDGER_12,
        client_id: 'acc-cash',
        name: 'Cash',
        type: 'asset',
      },
    ]
  }
  db.User.findByPk = async () => ({ id: USER_41, email: 'ledger@example.com', currentLedgerId: LEDGER_12 })

  t.after(() => {
    Account.findAll = originalFindAll
    db.User.findByPk = originalUserFindByPk
  })

  const server = http.createServer(app)
  await new Promise((resolve) => server.listen(0, resolve))
  t.after(() => server.close())

  const { port } = server.address()
  const response = await fetch(`http://127.0.0.1:${port}/api/accounts`, {
    headers: authHeader,
  })

  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.status, true)
  assert.equal(body.data.accounts.length, 1)
  assert.equal(body.data.accounts[0].client_id, 'acc-cash')
})

test('POST /api/accounts creates an account in the current ledger', async (t) => {
  const originalCreate = Account?.create
  const originalUserFindByPk = db.User.findByPk

  Account.create = async (payload) => {
    assert.equal(payload.ledger_id, LEDGER_12)
    return payload
  }
  db.User.findByPk = async () => ({ id: USER_41, email: 'ledger@example.com', currentLedgerId: LEDGER_12 })

  t.after(() => {
    Account.create = originalCreate
    db.User.findByPk = originalUserFindByPk
  })

  const server = http.createServer(app)
  await new Promise((resolve) => server.listen(0, resolve))
  t.after(() => server.close())

  const { port } = server.address()
  const response = await fetch(`http://127.0.0.1:${port}/api/accounts`, {
    method: 'POST',
    headers: { ...authHeader, 'content-type': 'application/json' },
    body: JSON.stringify({
      client_id: 'acc-card',
      name: 'Card',
      type: 'liability',
      currency: 'CNY',
      opening_balance: '88.30',
    }),
  })

  assert.equal(response.status, 201)
  const body = await response.json()
  assert.equal(body.status, true)
  assert.equal(body.data.account.client_id, 'acc-card')
  assert.equal(body.data.account.opening_balance, '88.30')
})

test('PATCH /api/accounts/:id updates an account', async (t) => {
  const originalFindOne = Account?.findOne
  const originalUserFindByPk = db.User.findByPk

  const record = {
    id: ACCOUNT_4,
    ledger_id: LEDGER_12,
    name: 'Wallet',
    async update(payload) {
      Object.assign(this, payload)
      return this
    },
  }

  Account.findOne = async ({ where }) => {
    assert.deepEqual(where, {
      id: ACCOUNT_4,
      ledger_id: LEDGER_12,
    })
    return record
  }
  db.User.findByPk = async () => ({ id: USER_41, email: 'ledger@example.com', currentLedgerId: LEDGER_12 })

  t.after(() => {
    Account.findOne = originalFindOne
    db.User.findByPk = originalUserFindByPk
  })

  const server = http.createServer(app)
  await new Promise((resolve) => server.listen(0, resolve))
  t.after(() => server.close())

  const { port } = server.address()
  const response = await fetch(`http://127.0.0.1:${port}/api/accounts/${ACCOUNT_4}`, {
    method: 'PATCH',
    headers: { ...authHeader, 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'Travel Wallet',
      currency: 'USD',
    }),
  })

  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.data.account.name, 'Travel Wallet')
  assert.equal(body.data.account.currency, 'USD')
})

test('GET /api/accounts falls back to request ledger_id when currentLedgerId is unavailable', async (t) => {
  const originalFindAll = Account?.findAll
  const originalUserFindByPk = db.User.findByPk

  Account.findAll = async (options) => {
    assert.deepEqual(options.where, {
      ledger_id: LEDGER_33,
      is_deleted: false,
    })

    return []
  }
  db.User.findByPk = async () => ({ id: USER_41, email: 'ledger@example.com', currentLedgerId: null })

  t.after(() => {
    Account.findAll = originalFindAll
    db.User.findByPk = originalUserFindByPk
  })

  const server = http.createServer(app)
  await new Promise((resolve) => server.listen(0, resolve))
  t.after(() => server.close())

  const { port } = server.address()
  const response = await fetch(
    `http://127.0.0.1:${port}/api/accounts?ledger_id=${encodeURIComponent(LEDGER_33)}`,
    {
      headers: authHeader,
    },
  )

  assert.equal(response.status, 200)
})
