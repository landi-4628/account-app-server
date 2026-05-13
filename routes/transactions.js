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

  success(res, 'Transactions fetched.', { transactions })
})

router.get('/:id', async (req, res) => {
  const transaction = await getTransaction(req.params.id, resolveLedgerId(req, { from: 'query' }))
  success(res, 'Transaction fetched.', { transaction })
})

router.post('/', async (req, res) => {
  const transaction = await Transaction.create(
    filterTransactionBody(req.body, {
      ledgerId: resolveLedgerId(req, { from: 'body' }),
    }),
  )
  success(res, 'Transaction created.', { transaction }, 201)
})

router.patch('/:id', async (req, res) => {
  const transaction = await getTransaction(req.params.id, resolveLedgerId(req, { from: 'query' }))

  await transaction.update(filterTransactionBody(req.body, { partial: true }))
  success(res, 'Transaction updated.', { transaction })
})

router.delete('/:id', async (req, res) => {
  const transaction = await getTransaction(req.params.id, resolveLedgerId(req, { from: 'query' }))

  await transaction.update({
    is_deleted: true,
    deleted_at: new Date(),
  })

  success(res, 'Transaction deleted.', { transaction })
})

async function getTransaction(id, ledgerId) {
  const normalizedId = normalizeEntityId(id)
  if (!normalizedId) {
    throw new NotFound(`Transaction ${id} not found.`)
  }

  const transaction = await Transaction.findOne({
    where: {
      id: normalizedId,
      ledger_id: ledgerId,
    },
  })

  if (!transaction) {
    throw new NotFound(`Transaction ${id} not found.`)
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

  throw new BadRequest('A current ledger is required for transaction operations.')
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
