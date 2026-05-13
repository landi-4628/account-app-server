import fs from 'fs'
import path from 'path'

export const DEFAULT_ENV = 'development'
export const META_TABLES = {
  migrate: 'SequelizeMeta',
  seed: 'SequelizeData',
}

export function normalizeCliOptions(argv = []) {
  const args = [...argv]
  const firstArg = args[0]
  const command = ['init', 'migrate', 'seed'].includes(firstArg) ? args.shift() : 'init'
  const options = {
    command,
    withSeed: command === 'init',
    dryRun: false,
    env: DEFAULT_ENV,
  }

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index]

    if (current === '--dry-run') {
      options.dryRun = true
      continue
    }

    if (current === '--no-seed') {
      options.withSeed = false
      continue
    }

    if (current === '--seed') {
      options.withSeed = true
      continue
    }

    if (current === '--env') {
      const value = args[index + 1]

      if (!value) {
        throw new Error('缺少 --env 对应的环境名称')
      }

      options.env = value
      index += 1
      continue
    }

    throw new Error(`不支持的参数: ${current}`)
  }

  return options
}

export function listTimestampedFiles(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    return []
  }

  return fs
    .readdirSync(directoryPath)
    .filter((fileName) => /^\d{14}.*\.js$/u.test(fileName))
    .sort((left, right) => left.localeCompare(right))
}

export function detectDuplicateNames(files = []) {
  const counters = new Map()

  for (const file of files) {
    const normalizedName = file.replace(/^\d{14}-?/u, '')
    counters.set(normalizedName, (counters.get(normalizedName) || 0) + 1)
  }

  return [...counters.entries()]
    .filter(([, count]) => count > 1)
    .map(([name]) => name)
    .sort((left, right) => left.localeCompare(right))
}

export function ensureNoDuplicateNames(files, label) {
  const duplicates = detectDuplicateNames(files)

  if (duplicates.length > 0) {
    throw new Error(`${label} 中存在重复文件名: ${duplicates.join(', ')}`)
  }
}

export function buildExecutionPlan({
  command,
  withSeed,
  dryRun,
  env,
  migrationFiles = [],
  seederFiles = [],
}) {
  const steps = [
    {
      type: 'database',
      title: '确保数据库存在',
      files: [],
    },
  ]

  if (command === 'init' || command === 'migrate') {
    steps.push({
      type: 'migrate',
      title: '执行迁移',
      files: [...migrationFiles],
    })
  }

  if (command === 'seed' || withSeed) {
    steps.push({
      type: 'seed',
      title: '执行种子',
      files: [...seederFiles],
    })
  }

  return {
    command,
    env,
    dryRun,
    withSeed,
    steps,
  }
}

export function formatPlan(plan) {
  const lines = [
    `数据库命令: ${plan.command}`,
    `运行环境: ${plan.env}`,
    `执行模式: ${plan.dryRun ? 'dry-run' : 'apply'}`,
  ]

  for (const step of plan.steps) {
    if (step.files.length === 0) {
      lines.push(`- ${step.title}`)
      continue
    }

    lines.push(`- ${step.title}: ${step.files.join(', ')}`)
  }

  return lines.join('\n')
}

export function resolveProjectPaths(projectRoot) {
  return {
    configFile: path.join(projectRoot, 'config', 'config.json'),
    migrationsDir: path.join(projectRoot, 'migrations'),
    seedersDir: path.join(projectRoot, 'seeders'),
  }
}

export function loadDbConfig(configFile, env) {
  const raw = JSON.parse(fs.readFileSync(configFile, 'utf8'))
  const config = raw[env]

  if (!config) {
    throw new Error(`未在 ${configFile} 中找到 ${env} 环境配置`)
  }

  return config
}
