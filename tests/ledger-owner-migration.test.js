import test from 'node:test'
import assert from 'node:assert/strict'

import migration from '../migrations/20260514183000-add-ledger-owner-user-id.js'

function createQueryInterfaceMock() {
  const calls = []

  return {
    calls,
    sequelize: {
      async query(sql) {
        calls.push({ method: 'query', sql })
      },
    },
    async addColumn(table, column, definition) {
      calls.push({ method: 'addColumn', table, column, definition })
    },
    async addIndex(table, fields, options) {
      calls.push({ method: 'addIndex', table, fields, options })
    },
    async addConstraint(table, options) {
      calls.push({ method: 'addConstraint', table, options })
    },
    async removeConstraint(table, name) {
      calls.push({ method: 'removeConstraint', table, name })
    },
    async removeIndex(table, name) {
      calls.push({ method: 'removeIndex', table, name })
    },
    async removeColumn(table, column) {
      calls.push({ method: 'removeColumn', table, column })
    },
  }
}

test('ledger owner migration up adds column, index, constraint, and backfills in two passes', async () => {
  const queryInterface = createQueryInterfaceMock()
  const Sequelize = { UUID: 'UUID' }

  await migration.up(queryInterface, Sequelize)

  assert.deepEqual(queryInterface.calls[0], {
    method: 'addColumn',
    table: 'Ledgers',
    column: 'owner_user_id',
    definition: {
      type: 'UUID',
      allowNull: true,
    },
  })
  assert.deepEqual(queryInterface.calls[1], {
    method: 'addIndex',
    table: 'Ledgers',
    fields: ['owner_user_id'],
    options: {
      name: 'ledgers_owner_user_id_idx',
    },
  })
  assert.deepEqual(queryInterface.calls[2], {
    method: 'addConstraint',
    table: 'Ledgers',
    options: {
      fields: ['owner_user_id'],
      type: 'foreign key',
      name: 'ledgers_owner_user_id_fkey',
      references: {
        table: 'Users',
        field: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
  })

  assert.equal(queryInterface.calls[3].method, 'query')
  assert.match(
    queryInterface.calls[3].sql,
    /INNER JOIN `Users` AS `u` ON `u`\.`current_ledger_id` = `l`\.`id`/u,
  )
  assert.match(queryInterface.calls[3].sql, /SET `l`\.`owner_user_id` = `u`\.`id`/u)
  assert.equal(queryInterface.calls[4].method, 'query')
  assert.match(queryInterface.calls[4].sql, /CONCAT\('default-ledger:', `u`\.`id`\)/u)
  assert.match(queryInterface.calls[4].sql, /`l`\.`owner_user_id` IS NULL/u)
})

test('ledger owner migration down removes constraint, index, and column', async () => {
  const queryInterface = createQueryInterfaceMock()

  await migration.down(queryInterface)

  assert.deepEqual(queryInterface.calls, [
    {
      method: 'removeConstraint',
      table: 'Ledgers',
      name: 'ledgers_owner_user_id_fkey',
    },
    {
      method: 'removeIndex',
      table: 'Ledgers',
      name: 'ledgers_owner_user_id_idx',
    },
    {
      method: 'removeColumn',
      table: 'Ledgers',
      column: 'owner_user_id',
    },
  ])
})
