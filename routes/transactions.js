import createError from 'http-errors'
import express from 'express'
import requireAuth from '../middlewares/auth.js'
import db from '../models/index.js'
import { normalizeEntityId } from '../utils/entity-id.js'
import { success } from '../utils/responses.js'

const router = express.Router()
const { Transaction } = db
const { BadRequest, NotFound } = createError

router.use(requireAuth)

router.get('/', async (req, res) => {
  const transactions = await Transaction.findAll({
    where: buildLedgerWhere(resolveLedgerId(req, { from: 'query' })),
    order: [
      ['occurred_at', 'DESC'],
      ['id', 'DESC'],
    ],
  })

  success(res, '已获取流水列表', { transactions })
})

router.get('/:id', async (req, res) => {
  const transaction = await getTransaction(req.params.id, resolveLedgerId(req, { from: 'query' }))
  success(res, '已获取流水详情', { transaction })
})

router.post('/', async (req, res) => {
  const transaction = await Transaction.create(
    filterTransactionBody(req.body, {
      ledgerId: resolveLedgerId(req, { from: 'body' }),
    }),
  )
  success(res, '流水已创建', { transaction }, 201)
})

router.patch('/:id', async (req, res) => {
  const transaction = await getTransaction(req.params.id, resolveLedgerId(req, { from: 'query' }))

  await transaction.update(filterTransactionBody(req.body, { partial: true }))
  success(res, '流水已更新', { transaction })
})

router.delete('/:id', async (req, res) => {
  const transaction = await getTransaction(req.params.id, resolveLedgerId(req, { from: 'query' }))

  await transaction.update({
    is_deleted: true,
    deleted_at: new Date(),
  })

  success(res, '流水已删除', { transaction })
})

async function getTransaction(id, ledgerId) {
  const normalizedId = normalizeEntityId(id)
  if (!normalizedId) {
    throw new BadRequest('无效的流水 id')
  }

  const transaction = await Transaction.findOne({
    where: {
      id: normalizedId,
      ledger_id: ledgerId,
    },
  })

  if (!transaction) {
    throw new NotFound(`未找到流水（id: ${id}）`)
  }

  return transaction
}

function resolveLedgerId(req, options = {}) {
  const fromUser = normalizeEntityId(req.user?.currentLedgerId)
  if (fromUser) {
    return fromUser
  }

  const fallbackSource = options.from === 'body' ? req.body : req.query
  const fromRequest = normalizeEntityId(fallbackSource?.ledger_id)
  if (fromRequest) {
    return fromRequest
  }

  throw new BadRequest('流水操作需要指定当前账本（currentLedgerId 或 ledger_id）。')
}

function buildLedgerWhere(ledgerId) {
  return {
    ledger_id: ledgerId,
    is_deleted: false,
  }
}

function filterTransactionBody(body, options = {}) {
  const payload = {
    ledger_id: options.partial ? undefined : options.ledgerId,
    account_id: body.account_id,
    category_id: body.category_id,
    client_id: body.client_id,
    kind: body.kind,
    amount: body.amount,
    note: body.note,
    occurred_at: body.occurred_at,
    is_deleted: body.is_deleted,
    deleted_at: body.deleted_at,
  }

  return options.partial ? removeUndefined(payload) : payload
}

function removeUndefined(payload) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined))
}

export default router
