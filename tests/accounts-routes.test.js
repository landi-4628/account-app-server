import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'

import app from '../app.js'
import db from '../models/index.js'
import { signAccessToken } from '../utils/auth-token.js'

const { Account } = db
const authHeader = {
  authorization: `Bearer ${signAccessToken({ sub: 41, email: 'ledger@example.com' })}`,
}

test('GET /api/accounts lists accounts for the current ledger', async (t) => {
  const originalFindAll = Account?.findAll
  const originalUserFindByPk = db.User.findByPk

  Account.findAll = async (options) => {
    assert.deepEqual(options, {
      where: {
        ledger_id: 12,
        is_deleted: false,
      },
      order: [['id', 'ASC']],
    })

    return [
      {
        id: 1,
        ledger_id: 12,
        client_id: 'acc-cash',
        name: 'Cash',
        type: 'asset',
      },
    ]
  }
  db.User.findByPk = async () => ({ id: 41, email: 'ledger@example.com', currentLedgerId: 12 })

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
    assert.equal(payload.ledger_id, 12)
    return payload
  }
  db.User.findByPk = async () => ({ id: 41, email: 'ledger@example.com', currentLedgerId: 12 })

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
    id: 4,
    ledger_id: 12,
    name: 'Wallet',
    async update(payload) {
      Object.assign(this, payload)
      return this
    },
  }

  Account.findOne = async ({ where }) => {
    assert.deepEqual(where, {
      id: 4,
      ledger_id: 12,
    })
    return record
  }
  db.User.findByPk = async () => ({ id: 41, email: 'ledger@example.com', currentLedgerId: 12 })

  t.after(() => {
    Account.findOne = originalFindOne
    db.User.findByPk = originalUserFindByPk
  })

  const server = http.createServer(app)
  await new Promise((resolve) => server.listen(0, resolve))
  t.after(() => server.close())

  const { port } = server.address()
  const response = await fetch(`http://127.0.0.1:${port}/api/accounts/4`, {
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
      ledger_id: 33,
      is_deleted: false,
    })

    return []
  }
  db.User.findByPk = async () => ({ id: 41, email: 'ledger@example.com', currentLedgerId: null })

  t.after(() => {
    Account.findAll = originalFindAll
    db.User.findByPk = originalUserFindByPk
  })

  const server = http.createServer(app)
  await new Promise((resolve) => server.listen(0, resolve))
  t.after(() => server.close())

  const { port } = server.address()
  const response = await fetch(`http://127.0.0.1:${port}/api/accounts?ledger_id=33`, {
    headers: authHeader,
  })

  assert.equal(response.status, 200)
})
