import createError from 'http-errors'
import db from '../../models/index.js'
import express from 'express'
import getPagination from '../../utils/pagination.js'
import { Op } from 'sequelize'
import { success } from '../../utils/responses.js'

const router = express.Router()
const { Article } = db
const { NotFound } = createError

/**
 * 查询文章列表
 * GET /admin/articles
 */
router.get('/', async function (req, res) {
  const { currentPage, pageSize, offset } = getPagination(req)
  const { title } = req.query

  const condition = {
    where: {},
    order: [['id', 'DESC']],
    limit: pageSize,
    offset: offset,
  }

  if (title) {
    condition.where.title = {
      [Op.like]: `%${title}%`,
    }
  }

  const { count, rows } = await Article.findAndCountAll(condition)
  success(res, '查询文章列表成功。', {
    articles: rows,
    pagination: {
      total: count,
      currentPage,
      pageSize,
    },
  })
})

/**
 * 查询文章详情
 * GET /admin/articles/:id
 */
router.get('/:id', async function (req, res) {
  const article = await getArticle(req)
  success(res, '查询文章成功。', { article })
})

/**
 * 创建文章
 * POST /admin/articles
 */
router.post('/', async function (req, res) {
  const body = filterBody(req)

  const article = await Article.create(body)
  success(res, '创建文章成功。', { article }, 201)
})

/**
 * 更新文章
 * PUT /admin/articles/:id
 */
router.put('/:id', async function (req, res) {
  const article = await getArticle(req)
  const body = filterBody(req)

  await article.update(body)
  success(res, '更新文章成功。', { article })
})

/**
 * 删除文章
 * DELETE /admin/articles/:id
 */
router.delete('/:id', async function (req, res) {
  const article = await getArticle(req)

  await article.destroy()
  success(res, '删除文章成功。')
})

/**
 * 公共方法：查询当前文章
 */
async function getArticle(req) {
  const { id } = req.params

  const article = await Article.findByPk(id)
  if (!article) {
    throw new NotFound(`未找到指定文章（id: ${id}）`)
  }

  return article
}

/**
 * 公共方法：白名单过滤
 * @param req
 * @returns {{title, content: (string|string|DocumentFragment|*)}}
 */
function filterBody(req) {
  return {
    title: req.body.title,
    content: req.body.content,
  }
}

export default router
