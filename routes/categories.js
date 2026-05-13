import createError from 'http-errors'
import express from 'express'
import requireAuth from '../middlewares/auth.js'
import db from '../models/index.js'
import { normalizeEntityId } from '../utils/entity-id.js'
import { success } from '../utils/responses.js'

const router = express.Router()
const { Category } = db
const { BadRequest, NotFound } = createError

router.use(requireAuth)

router.get('/', async (req, res) => {
  const categories = await Category.findAll({
    where: buildLedgerWhere(resolveLedgerId(req, { from: 'query' })),
    order: [['id', 'ASC']],
  })

  success(res, '已获取分类列表', { categories })
})

router.post('/', async (req, res) => {
  const category = await Category.create(
    filterCategoryBody(req.body, {
      ledgerId: resolveLedgerId(req, { from: 'body' }),
    }),
  )
  success(res, '分类已创建', { category }, 201)
})

router.patch('/:id', async (req, res) => {
  const category = await getCategory(req.params.id, resolveLedgerId(req, { from: 'query' }))

  await category.update(filterCategoryBody(req.body, { partial: true }))
  success(res, '分类已更新', { category })
})

async function getCategory(id, ledgerId) {
  const normalizedId = normalizeEntityId(id)
  if (!normalizedId) {
    throw new BadRequest('无效的分类 id')
  }

  const category = await Category.findOne({
    where: {
      id: normalizedId,
      ledger_id: ledgerId,
    },
  })

  if (!category) {
    throw new NotFound(`未找到分类（id: ${id}）`)
  }

  return category
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

  throw new BadRequest('分类操作需要指定当前账本（currentLedgerId 或 ledger_id）。')
}

function buildLedgerWhere(ledgerId) {
  return {
    ledger_id: ledgerId,
    is_deleted: false,
  }
}

function filterCategoryBody(body, options = {}) {
  const payload = {
    ledger_id: options.partial ? undefined : options.ledgerId,
    client_id: body.client_id,
    name: body.name,
    kind: body.kind,
    color: body.color,
    is_deleted: body.is_deleted,
    deleted_at: body.deleted_at,
  }

  return options.partial ? removeUndefined(payload) : payload
}

function removeUndefined(payload) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined))
}

export default router
