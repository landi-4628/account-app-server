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

  success(res, 'Categories fetched.', { categories })
})

router.post('/', async (req, res) => {
  const category = await Category.create(
    filterCategoryBody(req.body, {
      ledgerId: resolveLedgerId(req, { from: 'body' }),
    }),
  )
  success(res, 'Category created.', { category }, 201)
})

router.patch('/:id', async (req, res) => {
  const category = await getCategory(req.params.id, resolveLedgerId(req, { from: 'query' }))

  await category.update(filterCategoryBody(req.body, { partial: true }))
  success(res, 'Category updated.', { category })
})

async function getCategory(id, ledgerId) {
  const normalizedId = normalizeEntityId(id)
  if (!normalizedId) {
    throw new NotFound(`Category ${id} not found.`)
  }

  const category = await Category.findOne({
    where: {
      id: normalizedId,
      ledger_id: ledgerId,
    },
  })

  if (!category) {
    throw new NotFound(`Category ${id} not found.`)
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

  throw new BadRequest('A current ledger is required for category operations.')
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
