import createError from 'http-errors'
import express from 'express'
import { Op } from 'sequelize'
import requireAuth from '../middlewares/auth.js'
import db from '../models/index.js'
import { normalizeEntityId } from '../utils/entity-id.js'
import { success } from '../utils/responses.js'

const router = express.Router()
const { Category, Transaction } = db
const { BadRequest } = createError

router.use(requireAuth)

router.post('/push', async (req, res) => {
  const ledgerId = resolveLedgerId(req, { from: 'body' })
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

  success(res, '同步推送已完成', {
    categories,
    transactions,
    server_time: new Date().toISOString(),
  })
})

router.get('/pull', async (req, res) => {
  const where = buildPullWhere(req, { from: 'query' })

  const [categories, transactions] = await Promise.all([
    Category.findAll({ where, order: [['updatedAt', 'ASC'], ['id', 'ASC']] }),
    Transaction.findAll({ where, order: [['updatedAt', 'ASC'], ['id', 'ASC']] }),
  ])

  success(res, '同步拉取已完成', {
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

    records.push(await createOrRecoverExistingRecord(Model, payload))
  }

  return records
}

async function createOrRecoverExistingRecord(Model, payload) {
  try {
    return await Model.create(payload)
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error
    }

    const record = await findExistingRecord(Model, payload)
    if (!record) {
      throw error
    }

    await record.update(removeUndefined(payload))
    return record
  }
}

function isUniqueConstraintError(error) {
  return error?.name === 'SequelizeUniqueConstraintError'
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

  const remoteId = normalizeEntityId(payload.id)
  if (remoteId) {
    return Model.findOne({
      where: {
        id: remoteId,
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
  const fromUser = normalizeEntityId(req.user?.currentLedgerId ?? req.user?.current_ledger_id)
  if (fromUser) {
    return fromUser
  }

  const fallbackSource = options.from === 'body' ? req.body : req.query
  const fromRequest = normalizeEntityId(fallbackSource?.ledger_id)
  if (fromRequest) {
    return fromRequest
  }

  throw new BadRequest('同步操作需要指定当前账本（currentLedgerId 或 ledger_id）。')
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
    account_id: body.account_id != null ? String(body.account_id) : undefined,
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
