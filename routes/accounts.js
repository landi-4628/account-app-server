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

  success(res, '已获取账户列表', { accounts })
})

router.get('/:id', async (req, res) => {
  const account = await findAccount(req.params.id, resolveLedgerId(req, { from: 'query' }), {
    activeOnly: true,
  })
  success(res, '已获取账户', { account })
})

router.post('/', async (req, res) => {
  const account = await Account.create(
    filterAccountBody(req.body, {
      ledgerId: resolveLedgerId(req, { from: 'body' }),
    }),
  )
  success(res, '账户已创建', { account }, 201)
})

router.patch('/:id', async (req, res) => {
  const account = await findAccount(req.params.id, resolveLedgerId(req, { from: 'query' }), {
    activeOnly: false,
  })

  await account.update(filterAccountBody(req.body, { partial: true }))
  success(res, '账户已更新', { account })
})

router.delete('/:id', async (req, res) => {
  const account = await findAccount(req.params.id, resolveLedgerId(req, { from: 'query' }), {
    activeOnly: true,
  })

  await account.update({
    is_deleted: true,
    deleted_at: new Date(),
  })
  success(res, '账户已删除', { account })
})

/**
 * @param {string} id
 * @param {string} ledgerId
 * @param {{ activeOnly?: boolean }} [options]
 */
async function findAccount(id, ledgerId, options = {}) {
  const normalizedId = normalizeEntityId(id)
  if (!normalizedId) {
    throw new BadRequest('无效的账户 id')
  }

  const where = {
    id: normalizedId,
    ledger_id: ledgerId,
  }

  if (options.activeOnly) {
    Object.assign(where, { is_deleted: false })
  }

  const account = await Account.findOne({
    where,
  })

  if (!account) {
    throw new NotFound(`未找到账户（id: ${id}）`)
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

  throw new BadRequest('账户操作需要指定当前账本（currentLedgerId 或 ledger_id）。')
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
