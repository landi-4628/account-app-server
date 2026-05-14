import { randomUUID } from 'node:crypto'

import createError from 'http-errors'
import express from 'express'

import requireAuth from '../middlewares/auth.js'
import db from '../models/index.js'
import { normalizeEntityId } from '../utils/entity-id.js'
import { success } from '../utils/responses.js'

const router = express.Router()
const { BadRequest, NotFound } = createError

router.use(requireAuth)

router.get('/', async (req, res) => {
  const ledgers = await db.Ledger.findAll({
    where: {
      owner_user_id: req.user.id,
      is_deleted: false,
    },
    order: [['createdAt', 'ASC'], ['id', 'ASC']],
  })

  success(res, '已获取账本列表', {
    ledgers: ledgers.map(serializeLedger),
    currentLedgerId: readCurrentLedgerId(req.user),
  })
})

router.post('/', async (req, res) => {
  const name = String(req.body?.name || '').trim()
  if (!name) {
    throw new BadRequest('账本名称不能为空')
  }

  const ledger = await db.Ledger.create({
    name,
    base_currency: normalizeBaseCurrency(req.body?.base_currency),
    client_id: normalizeClientId(req.body?.client_id),
    owner_user_id: req.user.id,
  })

  const shouldSelectCurrent = req.body?.selectCurrent !== false
  if (shouldSelectCurrent) {
    await updateCurrentLedger(req.user, ledger.id)
  }

  success(
    res,
    '账本已创建',
    {
      ledger: serializeLedger(ledger),
      currentLedgerId: shouldSelectCurrent ? ledger.id : readCurrentLedgerId(req.user),
    },
    201,
  )
})

router.post('/:id/select', async (req, res) => {
  const ledger = await findOwnedLedger(req.params.id, req.user.id)

  await updateCurrentLedger(req.user, ledger.id)

  success(res, '当前账本已切换', {
    ledger: serializeLedger(ledger),
    currentLedgerId: ledger.id,
  })
})

async function findOwnedLedger(id, ownerUserId) {
  const normalizedId = normalizeEntityId(id)
  if (!normalizedId) {
    throw new BadRequest('无效的账本 id')
  }

  const ledger = await db.Ledger.findOne({
    where: {
      id: normalizedId,
      owner_user_id: ownerUserId,
      is_deleted: false,
    },
  })

  if (!ledger) {
    throw new NotFound(`未找到账本（id: ${id}）`)
  }

  return ledger
}

function normalizeBaseCurrency(value) {
  const normalized = String(value || 'CNY').trim().toUpperCase()
  return normalized || 'CNY'
}

function normalizeClientId(value) {
  return normalizeEntityId(value) ?? `ledger:${randomUUID()}`
}

function readCurrentLedgerId(user) {
  return user?.current_ledger_id ?? user?.currentLedgerId ?? null
}

async function updateCurrentLedger(user, ledgerId) {
  if (typeof user?.update === 'function') {
    await user.update({ current_ledger_id: ledgerId })
  } else {
    await db.User.update({ current_ledger_id: ledgerId }, { where: { id: user.id } })
  }

  user.current_ledger_id = ledgerId
  user.currentLedgerId = ledgerId
}

function serializeLedger(ledger) {
  return typeof ledger?.get === 'function' ? ledger.get() : ledger
}

export default router
