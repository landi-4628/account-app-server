import createError from 'http-errors'
import express from 'express'
import requireAuth from '../middlewares/auth.js'
import db from '../models/index.js'
import { normalizeEntityId } from '../utils/entity-id.js'
import { success } from '../utils/responses.js'

const router = express.Router()
const { Account } = db
const { BadRequest, NotFound } = createError

router.use(requireAuth)

router.get('/', async (req, res) => {
  const accounts = await Account.findAll({
    where: buildLedgerWhere(resolveLedgerId(req, { from: 'query' })),
    order: [['id', 'ASC']],
  })

  success(res, 'Accounts fetched.', { accounts })
})

router.post('/', async (req, res) => {
  const account = await Account.create(
    filterAccountBody(req.body, {
      ledgerId: resolveLedgerId(req, { from: 'body' }),
    }),
  )
  success(res, 'Account created.', { account }, 201)
})

router.patch('/:id', async (req, res) => {
  const account = await getAccount(req.params.id, resolveLedgerId(req, { from: 'query' }))

  await account.update(filterAccountBody(req.body, { partial: true }))
  success(res, 'Account updated.', { account })
})

async function getAccount(id, ledgerId) {
  const normalizedId = normalizeEntityId(id)
  if (!normalizedId) {
    throw new NotFound(`Account ${id} not found.`)
  }

  const account = await Account.findOne({
    where: {
      id: normalizedId,
      ledger_id: ledgerId,
    },
  })

  if (!account) {
    throw new NotFound(`Account ${id} not found.`)
  }

  return account
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

  throw new BadRequest('A current ledger is required for account operations.')
}

function buildLedgerWhere(ledgerId) {
  return {
    ledger_id: ledgerId,
    is_deleted: false,
  }
}

function filterAccountBody(body, options = {}) {
  const payload = {
    ledger_id: options.partial ? undefined : options.ledgerId,
    client_id: body.client_id,
    name: body.name,
    type: body.type,
    currency: body.currency,
    opening_balance: body.opening_balance,
    is_deleted: body.is_deleted,
    deleted_at: body.deleted_at,
  }

  return options.partial ? removeUndefined(payload) : payload
}

function removeUndefined(payload) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined))
}

export default router
