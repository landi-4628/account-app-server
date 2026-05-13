import test from 'node:test'
import assert from 'node:assert/strict'

import { buildArticleSeedData } from '../seeders/article-data.js'

test('生成 100 条文章初始数据并使用中文标题内容', () => {
  const articles = buildArticleSeedData()

  assert.equal(articles.length, 100)
  assert.equal(articles[0].title, '文章标题 1')
  assert.equal(articles[0].content, '文章内容 1')
  assert.ok(articles[0].createdAt instanceof Date)
  assert.ok(articles[0].updatedAt instanceof Date)
  assert.equal(articles[99].title, '文章标题 100')
  assert.equal(articles[99].content, '文章内容 100')
})

test('允许按数量生成文章初始数据', () => {
  const articles = buildArticleSeedData({ count: 3 })

  assert.deepEqual(
    articles.map((article) => ({
      title: article.title,
      content: article.content,
    })),
    [
      { title: '文章标题 1', content: '文章内容 1' },
      { title: '文章标题 2', content: '文章内容 2' },
      { title: '文章标题 3', content: '文章内容 3' },
    ],
  )
})
