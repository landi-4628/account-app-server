import express from 'express'
import authRouter from '../routes/auth.js'
import accountsRouter from '../routes/accounts.js'
import categoriesRouter from '../routes/categories.js'
import indexRouter from '../routes/index.js'
import meRouter from '../routes/me.js'
import syncRouter from '../routes/sync.js'
import transactionsRouter from '../routes/transactions.js'
import usersRouter from '../routes/users.js'

// 后台路由文件
import adminArticlesRouter from '../routes/admin/articles.js'

const router = express.Router()

// 后台路由配置
router.use('/admin/articles', adminArticlesRouter)

router.use('/auth', authRouter)
router.use('/api/accounts', accountsRouter)
router.use('/api/categories', categoriesRouter)
router.use('/api/sync', syncRouter)
router.use('/api/transactions', transactionsRouter)
router.use('/me', meRouter)
router.use('/', indexRouter)
router.use('/users', usersRouter)

export default router
