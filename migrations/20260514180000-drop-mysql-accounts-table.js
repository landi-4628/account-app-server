'use strict'

import { QueryTypes } from 'sequelize'

/**
 * 移除 Accounts 表；流水 account_id 改为客户端账户标识（VARCHAR，无 FK）。
 * 若仍存在 Accounts，会先将 account_id 从账户 UUID 回填为 client_id 再删表。
 *
 * @type {import('sequelize-cli').Migration}
 */
export default {
  async up(queryInterface) {
    const sequelize = queryInterface.sequelize

    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0')

    const constraints = await sequelize.query(
      `SELECT DISTINCT CONSTRAINT_NAME AS cname
       FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'Transactions'
         AND COLUMN_NAME = 'account_id'
         AND REFERENCED_TABLE_NAME = 'Accounts'`,
      { type: QueryTypes.SELECT }
    )

    for (const row of constraints) {
      const name = row.cname
      if (name) {
        await sequelize.query(`ALTER TABLE \`Transactions\` DROP FOREIGN KEY \`${name}\``)
      }
    }

    const [acctTables] = await sequelize.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Accounts'`
    )

    if (Array.isArray(acctTables) && acctTables.length > 0) {
      await sequelize.query(`
        UPDATE \`Transactions\` t
        INNER JOIN \`Accounts\` a ON a.id = t.account_id
        SET t.account_id = a.client_id
      `)
    }

    await sequelize.query(
      'ALTER TABLE `Transactions` MODIFY COLUMN `account_id` VARCHAR(64) NOT NULL'
    )

    await sequelize.query('DROP TABLE IF EXISTS `Accounts`')

    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1')
  },

  async down() {
    throw new Error(
      '20260514180000-drop-mysql-accounts-table: down() 未实现，请从备份恢复数据库。'
    )
  },
}
