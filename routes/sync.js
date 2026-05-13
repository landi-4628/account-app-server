import createError from 'http-errors'
import express from 'express'
import { Op } from 'sequelize'
import requireAuth from '../middlewares/auth.js'
import db from '../models/index.js'
import { success } from '../utils/responses.js'

const router = express.Router()
const { Account, Category, Transaction } = db
const { BadRequest } = createError

router.use(requireAuth)

router.post('/push', async (req, res) => {
  const ledgerId = resolveLedgerId(req, { from: 'body' })
  const accounts = await syncCollection(Account, req.body.accounts || [], filterAccountBody, ledgerId)
  const categories = await syncCollection(
    Category,
    req.body.categories || [],
    filterCategoryBody,
    ledgerId,
  )
  const transactions = await syncCollection(
    Transaction,
    req.body.transactions || [],
    filterTransactionBody,
    ledgerId,
  )

  success(res, 'Sync push completed.', {
    accounts,
    categories,
    transactions,
    server_time: new Date().toISOString(),
  })
})

router.get('/pull', async (req, res) => {
  const where = buildPullWhere(req, { from: 'query' })

  const [accounts, categories, transactions] = await Promise.all([
    Account.findAll({ where, order: [['updatedAt', 'ASC'], ['id', 'ASC']] }),
    Category.findAll({ where, order: [['updatedAt', 'ASC'], ['id', 'ASC']] }),
    Transaction.findAll({ where, order: [['updatedAt', 'ASC'], ['id', 'ASC']] }),
  ])

  success(res, 'Sync pull completed.', {
    accounts,
    categories,
    transactions,
    server_time: new Date().toISOString(),
  })
})

async function syncCollection(Model, items, filterBody, ledgerId) {
  const records = []

  for (const item of items) {
    const payload = filterBody(item, ledgerId)
    const record = await findExistingRecord(Model, payload)

    if (record) {
      await record.update(removeUndefined(payload))
      records.push(record)
      continue
    }

    records.push(await Model.create(payload))
  }

  return records
}

async function findExistingRecord(Model, payload) {
  if (payload.client_id) {
    const record = await Model.findOne({
      where: {
        ledger_id: payload.ledger_id,
        client_id: payload.client_id,
      },
    })
    if (record) {
      return record
    }
  }

  if (payload.id) {
    return Model.findOne({
      where: {
        id: Number(payload.id),
        ledger_id: payload.ledger_id,
      },
    })
  }

  return null
}

function buildPullWhere(req, options = {}) {
  const where = {
    ledger_id: resolveLedgerId(req, options),
  }

  if (req.query.since) {
    const since = new Date(req.query.since)
    if (!Number.isNaN(since.valueOf())) {
      where.updatedAt = { [Op.gt]: since }
    }
  }

  return where
}

function resolveLedgerId(req, options = {}) {
  const currentLedgerId = req.user?.currentLedgerId
  if (currentLedgerId !== undefined && currentLedgerId !== null) {
    return Number(currentLedgerId)
  }

  const fallbackSource = options.from === 'body' ? req.body : req.query
  const fallbackLedgerId = fallbackSource?.ledger_id

  if (fallbackLedgerId !== undefined && fallbackLedgerId !== null && fallbackLedgerId !== '') {
    return Number(fallbackLedgerId)
  }

  throw new BadRequest('A current ledger is required for sync operations.')
}

function filterAccountBody(body, ledgerId) {
  return removeUndefined({
    id: body.id,
    ledger_id: ledgerId,
    client_id: body.client_id,
    name: body.name,
    type: body.type,
    currency: body.currency,
    opening_balance: body.opening_balance,
    is_deleted: body.is_deleted,
    deleted_at: body.deleted_at,
  })
}

function filterCategoryBody(body, ledgerId) {
  return removeUndefined({
    id: body.id,
    ledger_id: ledgerId,
    client_id: body.client_id,
    name: body.name,
    kind: body.kind,
    color: body.color,
    is_deleted: body.is_deleted,
    deleted_at: body.deleted_at,
  })
}

function filterTransactionBody(body, ledgerId) {
  return removeUndefined({
    id: body.id,
    ledger_id: ledgerId,
    account_id: body.account_id,
    category_id: body.category_id,
    client_id: body.client_id,
    kind: body.kind,
    amount: body.amount,
    note: body.note,
    occurred_at: body.occurred_at,
    is_deleted: body.is_deleted,
    deleted_at: body.deleted_at,
  })
}

function removeUndefined(payload) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined))
}

export default router
