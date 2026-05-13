import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

import {
  buildExecutionPlan,
  detectDuplicateNames,
  normalizeCliOptions,
} from '../scripts/database-cli-lib.js'

test('normalizeCliOptions 在默认情况下启用 seed 并关闭 dry-run', () => {
  const options = normalizeCliOptions([])

  assert.deepEqual(options, {
    command: 'init',
    withSeed: true,
    dryRun: false,
    env: 'development',
  })
})

test('normalizeCliOptions 支持 migrate 子命令和 --no-seed', () => {
  const options = normalizeCliOptions(['migrate', '--no-seed', '--env', 'test'])

  assert.deepEqual(options, {
    command: 'migrate',
    withSeed: false,
    dryRun: false,
    env: 'test',
  })
})

test('buildExecutionPlan 为 init 命令输出建库、迁移和种子三个阶段', () => {
  const plan = buildExecutionPlan({
    command: 'init',
    withSeed: true,
    dryRun: false,
    env: 'development',
    migrationFiles: ['20260511095120-create-article.js'],
    seederFiles: ['20260511095234-article.js'],
  })

  assert.equal(plan.steps.length, 3)
  assert.equal(plan.steps[0].type, 'database')
  assert.equal(plan.steps[1].type, 'migrate')
  assert.equal(plan.steps[2].type, 'seed')
  assert.deepEqual(plan.steps[1].files, ['20260511095120-create-article.js'])
  assert.deepEqual(plan.steps[2].files, ['20260511095234-article.js'])
})

test('buildExecutionPlan 在 migrate 命令下不包含 seed 阶段', () => {
  const plan = buildExecutionPlan({
    command: 'migrate',
    withSeed: false,
    dryRun: false,
    env: 'development',
    migrationFiles: ['20260511095120-create-article.js'],
    seederFiles: ['20260511095234-article.js'],
  })

  assert.deepEqual(
    plan.steps.map((step) => step.type),
    ['database', 'migrate'],
  )
})

test('detectDuplicateNames 能找出重复文件名', () => {
  const duplicates = detectDuplicateNames([
    '20260511095120-create-article.js',
    '20260511095121-create-article.js',
    '20260511095234-article.js',
  ])

  assert.deepEqual(duplicates, ['create-article.js'])
})

test('database-cli dry-run 会输出初始化计划且不要求连接 MySQL', () => {
  const result = spawnSync('node', ['scripts/database-cli.js', 'init', '--dry-run'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  })

  assert.equal(result.status, 0)
  assert.match(result.stdout, /数据库命令: init/u)
  assert.match(result.stdout, /执行模式: dry-run/u)
  assert.match(result.stdout, /create-article\.js/u)
  assert.equal(result.stderr, '')
})
