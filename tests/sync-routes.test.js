import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'

import app from '../app.js'
import db from '../models/index.js'
import { signAccessToken } from '../utils/auth-token.js'

const { Account, Category, Transaction } = db

const USER_SYNC = '70000000-0000-4000-8000-000000000071'
const LEDGER_1 = '10000000-0000-4000-8000-000000000001'
const LEDGER_2 = '20000000-0000-4000-8000-000000000002'
const LEDGER_44 = '44000000-0000-4000-8000-000000000044'
const ACCOUNT_101 = 'a0100000-0000-4000-8000-000000000101'
const CATEGORY_201 = 'c0200000-0000-4000-8000-000000000201'
const TXN_301 = 't0300000-0000-4000-8000-000000000301'
const ACCOUNT_11 = 'a0110000-0000-4000-8000-000000000011'
const CATEGORY_12 = 'c0120000-0000-4000-8000-000000000012'
const TXN_13 = 't0130000-0000-4000-8000-000000000013'
const ACCOUNT_404 = 'a4040000-0000-4000-8000-000000000404'

const authHeader = {
  authorization: `Bearer ${signAccessToken({ sub: USER_SYNC, email: 'sync@example.com' })}`,
}

test('POST /api/sync/push upserts records by client_id for the current ledger', async (t) => {
  const originals = {
    accountFindOne: Account?.findOne,
    accountCreate: Account?.create,
    categoryFindOne: Category?.findOne,
    categoryCreate: Category?.create,
    transactionFindOne: Transaction?.findOne,
    transactionCreate: Transaction?.create,
    userFindByPk: db.User.findByPk,
  }

  const records = {
    account: null,
    category: null,
    transaction: null,
  }

  Account.findOne = async () => records.account
  Account.create = async (payload) => {
    assert.equal(payload.ledger_id, LEDGER_1)
    records.account = {
      id: ACCOUNT_101,
      ...payload,
      async update(nextPayload) {
        Object.assign(this, nextPayload)
        return this
      },
    }
    return records.account
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
    Account.findOne = originals.accountFindOne
    Account.create = originals.accountCreate
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
      accounts: [{ client_id: 'acc-1', name: 'Cash', type: 'asset' }],
      categories: [{ client_id: 'cat-1', name: 'Food', kind: 'expense' }],
      transactions: [
        {
          account_id: ACCOUNT_101,
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
  assert.equal(firstBody.data.accounts[0].id, ACCOUNT_101)
  assert.equal(firstBody.data.categories[0].id, CATEGORY_201)
  assert.equal(firstBody.data.transactions[0].id, TXN_301)

  const secondResponse = await fetch(`http://127.0.0.1:${port}/api/sync/push`, {
    method: 'POST',
    headers: { ...authHeader, 'content-type': 'application/json' },
    body: JSON.stringify({
      accounts: [{ client_id: 'acc-1', name: 'Cash Wallet', type: 'asset' }],
      categories: [],
      transactions: [],
    }),
  })

  assert.equal(secondResponse.status, 200)
  const secondBody = await secondResponse.json()
  assert.equal(secondBody.data.accounts[0].id, ACCOUNT_101)
  assert.equal(secondBody.data.accounts[0].name, 'Cash Wallet')
})

test('GET /api/sync/pull returns changed records for the current ledger since a timestamp', async (t) => {
  const originals = {
    accountFindAll: Account?.findAll,
    categoryFindAll: Category?.findAll,
    transactionFindAll: Transaction?.findAll,
    userFindByPk: db.User.findByPk,
  }

  Account.findAll = async (options) => {
    assert.equal(options.where.ledger_id, LEDGER_2)
    assert.ok(options.where.updatedAt)
    return [{ id: ACCOUNT_11, client_id: 'acc-2' }]
  }

  Category.findAll = async () => [{ id: CATEGORY_12, client_id: 'cat-2' }]
  Transaction.findAll = async () => [{ id: TXN_13, client_id: 'txn-2' }]
  db.User.findByPk = async () => ({ id: USER_SYNC, email: 'sync@example.com', currentLedgerId: LEDGER_2 })

  t.after(() => {
    Account.findAll = originals.accountFindAll
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
  assert.equal(body.data.accounts[0].client_id, 'acc-2')
  assert.equal(body.data.categories[0].client_id, 'cat-2')
  assert.equal(body.data.transactions[0].client_id, 'txn-2')
  assert.ok(body.data.server_time)
})

test('POST /api/sync/push falls back to body ledger_id when currentLedgerId is unavailable', async (t) => {
  const originals = {
    accountFindOne: Account?.findOne,
    accountCreate: Account?.create,
    userFindByPk: db.User.findByPk,
  }

  Account.findOne = async () => null
  Account.create = async (payload) => {
    assert.equal(payload.ledger_id, LEDGER_44)
    return { id: ACCOUNT_404, ...payload }
  }
  db.User.findByPk = async () => ({ id: USER_SYNC, email: 'sync@example.com', currentLedgerId: undefined })

  t.after(() => {
    Account.findOne = originals.accountFindOne
    Account.create = originals.accountCreate
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
      accounts: [{ client_id: 'acc-fallback', name: 'Fallback Cash', type: 'asset' }],
    }),
  })

  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.data.accounts[0].ledger_id, LEDGER_44)
})
