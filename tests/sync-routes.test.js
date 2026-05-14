import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'

import app from '../app.js'
import db from '../models/index.js'
import { signAccessToken } from '../utils/auth-token.js'

const { Category, Transaction } = db

const USER_SYNC = '70000000-0000-4000-8000-000000000071'
const LEDGER_1 = '10000000-0000-4000-8000-000000000001'
const LEDGER_2 = '20000000-0000-4000-8000-000000000002'
const LEDGER_44 = '44000000-0000-4000-8000-000000000044'
const CATEGORY_201 = 'c0200000-0000-4000-8000-000000000201'
const TXN_301 = 't0300000-0000-4000-8000-000000000301'
const CATEGORY_12 = 'c0120000-0000-4000-8000-000000000012'
const TXN_13 = 't0130000-0000-4000-8000-000000000013'

const authHeader = {
  authorization: `Bearer ${signAccessToken({ sub: USER_SYNC, email: 'sync@example.com' })}`,
}

test('POST /api/sync/push upserts categories and transactions for the current ledger', async (t) => {
  const originals = {
    categoryFindOne: Category?.findOne,
    categoryCreate: Category?.create,
    transactionFindOne: Transaction?.findOne,
    transactionCreate: Transaction?.create,
    userFindByPk: db.User.findByPk,
  }

  const records = {
    category: null,
    transaction: null,
  }

  Category.findOne = async () => records.category
  Category.create = async (payload) => {
    assert.equal(payload.ledger_id, LEDGER_1)
    records.category = {
      id: CATEGORY_201,
      ...payload,
      async update(nextPayload) {
        Object.assign(this, nextPayload)
        return this
      },
    }
    return records.category
  }

  Transaction.findOne = async () => records.transaction
  Transaction.create = async (payload) => {
    assert.equal(payload.ledger_id, LEDGER_1)
    assert.equal(payload.account_id, 'acc-cash')
    records.transaction = {
      id: TXN_301,
      ...payload,
      async update(nextPayload) {
        Object.assign(this, nextPayload)
        return this
      },
    }
    return records.transaction
  }
  db.User.findByPk = async () => ({ id: USER_SYNC, email: 'sync@example.com', currentLedgerId: LEDGER_1 })

  t.after(() => {
    Category.findOne = originals.categoryFindOne
    Category.create = originals.categoryCreate
    Transaction.findOne = originals.transactionFindOne
    Transaction.create = originals.transactionCreate
    db.User.findByPk = originals.userFindByPk
  })

  const server = http.createServer(app)
  await new Promise((resolve) => server.listen(0, resolve))
  t.after(() => server.close())

  const { port } = server.address()

  const firstResponse = await fetch(`http://127.0.0.1:${port}/api/sync/push`, {
    method: 'POST',
    headers: { ...authHeader, 'content-type': 'application/json' },
    body: JSON.stringify({
      categories: [{ client_id: 'cat-1', name: 'Food', kind: 'expense' }],
      transactions: [
        {
          account_id: 'acc-cash',
          category_id: CATEGORY_201,
          client_id: 'txn-1',
          amount: '18.00',
          kind: 'expense',
          occurred_at: '2026-05-13T08:00:00.000Z',
        },
      ],
    }),
  })

  assert.equal(firstResponse.status, 200)
  const firstBody = await firstResponse.json()
  assert.equal(firstBody.data.categories[0].id, CATEGORY_201)
  assert.equal(firstBody.data.transactions[0].id, TXN_301)
  assert.equal(firstBody.data.transactions[0].account_id, 'acc-cash')
  assert.equal(firstBody.data.accounts, undefined)

  const secondResponse = await fetch(`http://127.0.0.1:${port}/api/sync/push`, {
    method: 'POST',
    headers: { ...authHeader, 'content-type': 'application/json' },
    body: JSON.stringify({
      categories: [{ client_id: 'cat-1', name: 'Food updated', kind: 'expense' }],
      transactions: [],
    }),
  })

  assert.equal(secondResponse.status, 200)
  const secondBody = await secondResponse.json()
  assert.equal(secondBody.data.categories[0].id, CATEGORY_201)
  assert.equal(secondBody.data.categories[0].name, 'Food updated')
})

test('GET /api/sync/pull returns changed records for the current ledger since a timestamp', async (t) => {
  const originals = {
    categoryFindAll: Category?.findAll,
    transactionFindAll: Transaction?.findAll,
    userFindByPk: db.User.findByPk,
  }

  Category.findAll = async (options) => {
    assert.equal(options.where.ledger_id, LEDGER_2)
    assert.ok(options.where.updatedAt)
    return [{ id: CATEGORY_12, client_id: 'cat-2' }]
  }
  Transaction.findAll = async () => [{ id: TXN_13, client_id: 'txn-2', account_id: 'acc-bank' }]
  db.User.findByPk = async () => ({ id: USER_SYNC, email: 'sync@example.com', currentLedgerId: LEDGER_2 })

  t.after(() => {
    Category.findAll = originals.categoryFindAll
    Transaction.findAll = originals.transactionFindAll
    db.User.findByPk = originals.userFindByPk
  })

  const server = http.createServer(app)
  await new Promise((resolve) => server.listen(0, resolve))
  t.after(() => server.close())

  const { port } = server.address()
  const response = await fetch(
    `http://127.0.0.1:${port}/api/sync/pull?since=2026-05-10T00:00:00.000Z`,
    {
      headers: authHeader,
    },
  )

  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.data.accounts, undefined)
  assert.equal(body.data.categories[0].client_id, 'cat-2')
  assert.equal(body.data.transactions[0].client_id, 'txn-2')
  assert.equal(body.data.transactions[0].account_id, 'acc-bank')
  assert.ok(body.data.server_time)
})

test('POST /api/sync/push falls back to body ledger_id when currentLedgerId is unavailable', async (t) => {
  const originals = {
    categoryFindOne: Category?.findOne,
    categoryCreate: Category?.create,
    ledgerFindOrCreate: db.Ledger.findOrCreate,
    userFindByPk: db.User.findByPk,
  }

  Category.findOne = async () => null
  Category.create = async (payload) => {
    assert.equal(payload.ledger_id, LEDGER_44)
    return { id: CATEGORY_201, ...payload }
  }
  db.Ledger.findOrCreate = async () => [
    {
      id: LEDGER_1,
      async update() {
        return this
      },
    },
    true,
  ]
  db.User.findByPk = async () => ({ id: USER_SYNC, email: 'sync@example.com', currentLedgerId: undefined })

  t.after(() => {
    Category.findOne = originals.categoryFindOne
    Category.create = originals.categoryCreate
    db.Ledger.findOrCreate = originals.ledgerFindOrCreate
    db.User.findByPk = originals.userFindByPk
  })

  const server = http.createServer(app)
  await new Promise((resolve) => server.listen(0, resolve))
  t.after(() => server.close())

  const { port } = server.address()
  const response = await fetch(`http://127.0.0.1:${port}/api/sync/push`, {
    method: 'POST',
    headers: { ...authHeader, 'content-type': 'application/json' },
    body: JSON.stringify({
      ledger_id: LEDGER_44,
      categories: [{ client_id: 'cat-fallback', name: 'Misc', kind: 'expense' }],
    }),
  })

  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.data.categories[0].ledger_id, LEDGER_44)
})

test('POST /api/sync/push accepts current_ledger_id from authenticated sequelize-style users', async (t) => {
  const originals = {
    categoryFindOne: Category?.findOne,
    categoryCreate: Category?.create,
    userFindByPk: db.User.findByPk,
  }

  Category.findOne = async () => null
  Category.create = async (payload) => {
    assert.equal(payload.ledger_id, LEDGER_1)
    return { id: CATEGORY_201, ...payload }
  }
  db.User.findByPk = async () => ({
    id: USER_SYNC,
    email: 'sync@example.com',
    current_ledger_id: LEDGER_1,
  })

  t.after(() => {
    Category.findOne = originals.categoryFindOne
    Category.create = originals.categoryCreate
    db.User.findByPk = originals.userFindByPk
  })

  const server = http.createServer(app)
  await new Promise((resolve) => server.listen(0, resolve))
  t.after(() => server.close())

  const { port } = server.address()
  const response = await fetch(`http://127.0.0.1:${port}/api/sync/push`, {
    method: 'POST',
    headers: { ...authHeader, 'content-type': 'application/json' },
    body: JSON.stringify({
      categories: [{ client_id: 'cat-sequelize', name: 'Meals', kind: 'expense' }],
    }),
  })

  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.data.categories[0].ledger_id, LEDGER_1)
})
