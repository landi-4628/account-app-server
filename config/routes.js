import express from 'express'
import indexRouter from '../routes/index.js'
import usersRouter from '../routes/users.js'

// 后台路由文件
import adminArticlesRouter from '../routes/admin/articles.js'

const router = express.Router()

// 后台路由配置
router.use('/admin/articles', adminArticlesRouter)

router.use('/', indexRouter)
router.use('/users', usersRouter)

export default router
