import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'

import app from '../app.js'
import db from '../models/index.js'
import { signAccessToken } from '../utils/auth-token.js'

const { Category } = db
const authHeader = {
  authorization: `Bearer ${signAccessToken({ sub: 51, email: 'category@example.com' })}`,
}

test('GET /api/categories lists categories for the current ledger', async (t) => {
  const originalFindAll = Category?.findAll
  const originalUserFindByPk = db.User.findByPk

  Category.findAll = async (options) => {
    assert.deepEqual(options, {
      where: {
        ledger_id: 5,
        is_deleted: false,
      },
      order: [['id', 'ASC']],
    })

    return [
      {
        id: 7,
        ledger_id: 5,
        client_id: 'cat-food',
        name: 'Food',
        kind: 'expense',
      },
    ]
  }
  db.User.findByPk = async () => ({ id: 51, email: 'category@example.com', currentLedgerId: 5 })

  t.after(() => {
    Category.findAll = originalFindAll
    db.User.findByPk = originalUserFindByPk
  })

  const server = http.createServer(app)
  await new Promise((resolve) => server.listen(0, resolve))
  t.after(() => server.close())

  const { port } = server.address()
  const response = await fetch(`http://127.0.0.1:${port}/api/categories`, {
    headers: authHeader,
  })

  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.data.categories[0].name, 'Food')
})

test('POST /api/categories creates a category in the current ledger', async (t) => {
  const originalCreate = Category?.create
  const originalUserFindByPk = db.User.findByPk

  Category.create = async (payload) => {
    assert.equal(payload.ledger_id, 5)
    return payload
  }
  db.User.findByPk = async () => ({ id: 51, email: 'category@example.com', currentLedgerId: 5 })

  t.after(() => {
    Category.create = originalCreate
    db.User.findByPk = originalUserFindByPk
  })

  const server = http.createServer(app)
  await new Promise((resolve) => server.listen(0, resolve))
  t.after(() => server.close())

  const { port } = server.address()
  const response = await fetch(`http://127.0.0.1:${port}/api/categories`, {
    method: 'POST',
    headers: { ...authHeader, 'content-type': 'application/json' },
    body: JSON.stringify({
      client_id: 'cat-rent',
      name: 'Rent',
      kind: 'expense',
      color: '#ffcc00',
    }),
  })

  assert.equal(response.status, 201)
  const body = await response.json()
  assert.equal(body.data.category.client_id, 'cat-rent')
})

test('PATCH /api/categories/:id updates a category', async (t) => {
  const originalFindOne = Category?.findOne
  const originalUserFindByPk = db.User.findByPk

  const record = {
    id: 3,
    ledger_id: 5,
    name: 'Bills',
    async update(payload) {
      Object.assign(this, payload)
      return this
    },
  }

  Category.findOne = async ({ where }) => {
    assert.deepEqual(where, {
      id: 3,
      ledger_id: 5,
    })

    return record
  }
  db.User.findByPk = async () => ({ id: 51, email: 'category@example.com', currentLedgerId: 5 })

  t.after(() => {
    Category.findOne = originalFindOne
    db.User.findByPk = originalUserFindByPk
  })

  const server = http.createServer(app)
  await new Promise((resolve) => server.listen(0, resolve))
  t.after(() => server.close())

  const { port } = server.address()
  const response = await fetch(`http://127.0.0.1:${port}/api/categories/3`, {
    method: 'PATCH',
    headers: { ...authHeader, 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'Utilities',
      color: '#3366ff',
    }),
  })

  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.data.category.name, 'Utilities')
  assert.equal(body.data.category.color, '#3366ff')
})
