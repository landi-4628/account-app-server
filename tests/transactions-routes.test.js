import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'

import app from '../app.js'
import db from '../models/index.js'
import { signAccessToken } from '../utils/auth-token.js'

const { Transaction } = db
const authHeader = {
  authorization: `Bearer ${signAccessToken({ sub: 61, email: 'transaction@example.com' })}`,
}

test('GET /api/transactions lists transactions for the current ledger', async (t) => {
  const originalFindAll = Transaction?.findAll
  const originalUserFindByPk = db.User.findByPk

  Transaction.findAll = async (options) => {
    assert.deepEqual(options, {
      where: {
        ledger_id: 8,
        is_deleted: false,
      },
      order: [['occurred_at', 'DESC'], ['id', 'DESC']],
    })

    return [
      {
        id: 22,
        ledger_id: 8,
        client_id: 'txn-1',
        amount: '28.50',
      },
    ]
  }
  db.User.findByPk = async () => ({ id: 61, email: 'transaction@example.com', currentLedgerId: 8 })

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
    assert.equal(payload.ledger_id, 8)
    return payload
  }
  db.User.findByPk = async () => ({ id: 61, email: 'transaction@example.com', currentLedgerId: 8 })

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
      account_id: 1,
      category_id: 2,
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
    id: 2,
    ledger_id: 8,
    note: 'Old',
    async update(payload) {
      Object.assign(this, payload)
      return this
    },
  }

  Transaction.findOne = async ({ where }) => {
    assert.deepEqual(where, {
      id: 2,
      ledger_id: 8,
    })

    return record
  }
  db.User.findByPk = async () => ({ id: 61, email: 'transaction@example.com', currentLedgerId: 8 })

  t.after(() => {
    Transaction.findOne = originalFindOne
    db.User.findByPk = originalUserFindByPk
  })

  const server = http.createServer(app)
  await new Promise((resolve) => server.listen(0, resolve))
  t.after(() => server.close())

  const { port } = server.address()
  const response = await fetch(`http://127.0.0.1:${port}/api/transactions/2`, {
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
    id: 9,
    ledger_id: 8,
    is_deleted: false,
    deleted_at: null,
    async update(payload) {
      Object.assign(this, payload)
      return this
    },
  }

  Transaction.findOne = async ({ where }) => {
    assert.deepEqual(where, {
      id: 9,
      ledger_id: 8,
    })

    return record
  }
  db.User.findByPk = async () => ({ id: 61, email: 'transaction@example.com', currentLedgerId: 8 })

  t.after(() => {
    Transaction.findOne = originalFindOne
    db.User.findByPk = originalUserFindByPk
  })

  const server = http.createServer(app)
  await new Promise((resolve) => server.listen(0, resolve))
  t.after(() => server.close())

  const { port } = server.address()
  const response = await fetch(`http://127.0.0.1:${port}/api/transactions/9`, {
    method: 'DELETE',
    headers: authHeader,
  })

  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.data.transaction.is_deleted, true)
  assert.ok(body.data.transaction.deleted_at)
})
