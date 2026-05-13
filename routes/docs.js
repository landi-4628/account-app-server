import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'

const router = express.Router()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const docsDir = path.resolve(__dirname, '../docs')

router.get('/openapi.json', (req, res) => {
  res.type('application/json')
  res.sendFile(path.join(docsDir, 'openapi.json'))
})

router.get('/openapi.yaml', (req, res) => {
  res.type('application/yaml')
  res.sendFile(path.join(docsDir, 'openapi.yaml'))
})

router.get('/', (req, res) => {
  res.render('docs', {
    title: 'account-app-sever API',
  })
})

export default router
