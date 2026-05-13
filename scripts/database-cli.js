import path from 'path'
import process from 'process'
import { fileURLToPath, pathToFileURL } from 'url'

import mysql from 'mysql2/promise'
import Sequelize from 'sequelize'

import {
  META_TABLES,
  buildExecutionPlan,
  ensureNoDuplicateNames,
  formatPlan,
  listTimestampedFiles,
  loadDbConfig,
  normalizeCliOptions,
  resolveProjectPaths,
} from './database-cli-lib.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

async function ensureDatabaseExists(config) {
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password,
  })

  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`,
    )
  } finally {
    await connection.end()
  }
}

async function ensureMetaTable(queryInterface, tableName) {
  await queryInterface.sequelize.query(
    `CREATE TABLE IF NOT EXISTS \`${tableName}\` (
      name VARCHAR(255) NOT NULL PRIMARY KEY,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  )
}

async function getExecutedNames(queryInterface, tableName) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT name FROM \`${tableName}\` ORDER BY name ASC`,
  )

  return new Set(rows.map((row) => row.name))
}

async function markAsExecuted(queryInterface, tableName, fileName) {
  await queryInterface.sequelize.query(`INSERT INTO \`${tableName}\` (name) VALUES (?)`, {
    replacements: [fileName],
  })
}

async function runFiles({ directoryPath, fileNames, tableName, stepName, sequelize }) {
  const queryInterface = sequelize.getQueryInterface()
  await ensureMetaTable(queryInterface, tableName)

  const executedNames = await getExecutedNames(queryInterface, tableName)
  const pendingFiles = fileNames.filter((fileName) => !executedNames.has(fileName))

  if (pendingFiles.length === 0) {
    console.log(`${stepName}: 没有待执行文件`)
    return
  }

  for (const fileName of pendingFiles) {
    const filePath = path.join(directoryPath, fileName)
    const moduleUrl = pathToFileURL(filePath).href
    const module = await import(moduleUrl)
    const runner = module.default

    if (!runner || typeof runner.up !== 'function') {
      throw new Error(`${stepName} 文件 ${fileName} 缺少默认导出的 up 方法`)
    }

    // 逐个执行并记录，便于在失败时定位到具体文件。
    await runner.up(queryInterface, Sequelize)
    await markAsExecuted(queryInterface, tableName, fileName)
    console.log(`${stepName}: 已执行 ${fileName}`)
  }
}

async function runCli() {
  const options = normalizeCliOptions(process.argv.slice(2))
  const paths = resolveProjectPaths(projectRoot)
  const config = loadDbConfig(paths.configFile, options.env)
  const migrationFiles = listTimestampedFiles(paths.migrationsDir)
  const seederFiles = listTimestampedFiles(paths.seedersDir)

  ensureNoDuplicateNames(migrationFiles, '迁移目录')
  ensureNoDuplicateNames(seederFiles, '种子目录')

  const plan = buildExecutionPlan({
    ...options,
    migrationFiles,
    seederFiles,
  })

  console.log(formatPlan(plan))

  if (options.dryRun) {
    return
  }

  await ensureDatabaseExists(config)

  const sequelize = new Sequelize(config.database, config.username, config.password, config)

  try {
    if (options.command === 'init' || options.command === 'migrate') {
      await runFiles({
        directoryPath: paths.migrationsDir,
        fileNames: migrationFiles,
        tableName: META_TABLES.migrate,
        stepName: '迁移',
        sequelize,
      })
    }

    if (options.command === 'seed' || options.withSeed) {
      await runFiles({
        directoryPath: paths.seedersDir,
        fileNames: seederFiles,
        tableName: META_TABLES.seed,
        stepName: '种子',
        sequelize,
      })
    }
  } finally {
    await sequelize.close()
  }
}

runCli().catch((error) => {
  console.error(`数据库初始化失败：${error.message}`)
  process.exitCode = 1
})
