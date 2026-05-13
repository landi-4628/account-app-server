import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'

import app from '../app.js'
import db from '../models/index.js'
import { signAccessToken } from '../utils/auth-token.js'

const { Transaction } = db

const USER_61 = '61000000-0000-4000-8000-000000000061'
const LEDGER_8 = '08000000-0000-4000-8000-000000000008'
const TXN_22 = 't0000022-0000-4000-8000-000000000022'
const TXN_2 = 't0000002-0000-4000-8000-000000000002'
const TXN_9 = 't0000009-0000-4000-8000-000000000009'
const ACCOUNT_1 = 'a0000001-0000-4000-8000-000000000001'
const CATEGORY_2 = 'c0000002-0000-4000-8000-000000000002'

const authHeader = {
  authorization: `Bearer ${signAccessToken({ sub: USER_61, email: 'transaction@example.com' })}`,
}

test('GET /api/transactions lists transactions for the current ledger', async (t) => {
  const originalFindAll = Transaction?.findAll
  const originalUserFindByPk = db.User.findByPk

  Transaction.findAll = async (options) => {
    assert.deepEqual(options, {
      where: {
        ledger_id: LEDGER_8,
        is_deleted: false,
      },
      order: [['occurred_at', 'DESC'], ['id', 'DESC']],
    })

    return [
      {
        id: TXN_22,
        ledger_id: LEDGER_8,
        client_id: 'txn-1',
        amount: '28.50',
      },
    ]
  }
  db.User.findByPk = async () => ({ id: USER_61, email: 'transaction@example.com', currentLedgerId: LEDGER_8 })

  t.after(() => {
    Transaction.findAll = originalFindAll
    db.User.findByPk = originalUserFindByPk
  })

  const server = http.createServer(app)
  await new Promise((resolve) => server.listen(0, resolve))
  t.after(() => server.close())

  const { port } = server.address()
  const response = await fetch(`http://127.0.0.1:${port}/api/transactions`, {
    headers: authHeader,
  })

  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.data.transactions[0].client_id, 'txn-1')
})

test('POST /api/transactions creates a transaction in the current ledger', async (t) => {
  const originalCreate = Transaction?.create
  const originalUserFindByPk = db.User.findByPk

  Transaction.create = async (payload) => {
    assert.equal(payload.ledger_id, LEDGER_8)
    return payload
  }
  db.User.findByPk = async () => ({ id: USER_61, email: 'transaction@example.com', currentLedgerId: LEDGER_8 })

  t.after(() => {
    Transaction.create = originalCreate
    db.User.findByPk = originalUserFindByPk
  })

  const server = http.createServer(app)
  await new Promise((resolve) => server.listen(0, resolve))
  t.after(() => server.close())

  const { port } = server.address()
  const response = await fetch(`http://127.0.0.1:${port}/api/transactions`, {
    method: 'POST',
    headers: { ...authHeader, 'content-type': 'application/json' },
    body: JSON.stringify({
      account_id: ACCOUNT_1,
      category_id: CATEGORY_2,
      client_id: 'txn-2',
      amount: '128.00',
      kind: 'expense',
      occurred_at: '2026-05-13T08:00:00.000Z',
      note: 'Groceries',
    }),
  })

  assert.equal(response.status, 201)
  const body = await response.json()
  assert.equal(body.data.transaction.client_id, 'txn-2')
})

test('PATCH /api/transactions/:id updates a transaction', async (t) => {
  const originalFindOne = Transaction?.findOne
  const originalUserFindByPk = db.User.findByPk

  const record = {
    id: TXN_2,
    ledger_id: LEDGER_8,
    note: 'Old',
    async update(payload) {
      Object.assign(this, payload)
      return this
    },
  }

  Transaction.findOne = async ({ where }) => {
    assert.deepEqual(where, {
      id: TXN_2,
      ledger_id: LEDGER_8,
    })

    return record
  }
  db.User.findByPk = async () => ({ id: USER_61, email: 'transaction@example.com', currentLedgerId: LEDGER_8 })

  t.after(() => {
    Transaction.findOne = originalFindOne
    db.User.findByPk = originalUserFindByPk
  })

  const server = http.createServer(app)
  await new Promise((resolve) => server.listen(0, resolve))
  t.after(() => server.close())

  const { port } = server.address()
  const response = await fetch(`http://127.0.0.1:${port}/api/transactions/${TXN_2}`, {
    method: 'PATCH',
    headers: { ...authHeader, 'content-type': 'application/json' },
    body: JSON.stringify({
      note: 'Lunch',
      amount: '38.60',
    }),
  })

  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.data.transaction.note, 'Lunch')
})

test('DELETE /api/transactions/:id marks a transaction deleted', async (t) => {
  const originalFindOne = Transaction?.findOne
  const originalUserFindByPk = db.User.findByPk

  const record = {
    id: TXN_9,
    ledger_id: LEDGER_8,
    is_deleted: false,
    deleted_at: null,
    async update(payload) {
      Object.assign(this, payload)
      return this
    },
  }

  Transaction.findOne = async ({ where }) => {
    assert.deepEqual(where, {
      id: TXN_9,
      ledger_id: LEDGER_8,
    })

    return record
  }
  db.User.findByPk = async () => ({ id: USER_61, email: 'transaction@example.com', currentLedgerId: LEDGER_8 })

  t.after(() => {
    Transaction.findOne = originalFindOne
    db.User.findByPk = originalUserFindByPk
  })

  const server = http.createServer(app)
  await new Promise((resolve) => server.listen(0, resolve))
  t.after(() => server.close())

  const { port } = server.address()
  const response = await fetch(`http://127.0.0.1:${port}/api/transactions/${TXN_9}`, {
    method: 'DELETE',
    headers: authHeader,
  })

  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.data.transaction.is_deleted, true)
  assert.ok(body.data.transaction.deleted_at)
})
