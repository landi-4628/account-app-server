'use strict'

/**
 * 修复「模型已是 UUID、库里仍是整型主键」导致的 ER_TRUNCATED_WRONG_VALUE_FOR_FIELD。
 *
 * 此前若已跑过旧版 migration，SequelizeMeta 会阻止旧文件再次执行，表结构不会自动升级。
 * 本迁移：在关闭外键检查后 DROP 核心业务表，再按 UUID 定义重建。
 *
 * 警告：会清空 Users / Ledgers / 账本相关表及 Articles 中的数据。生产环境须先备份并评估数据迁移方案。
 *
 * @type {import('sequelize-cli').Migration}
 */
export default {
  async up(queryInterface, Sequelize) {
    const sequelize = queryInterface.sequelize
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0')
    const tables = [
      'RefreshTokens',
      'Transactions',
      'Categories',
      'Accounts',
      'Users',
      'Ledgers',
      'Articles',
    ]
    for (const name of tables) {
      await sequelize.query(`DROP TABLE IF EXISTS \`${name}\``)
    }
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1')

    await queryInterface.createTable('Ledgers', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      client_id: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      base_currency: {
        type: Sequelize.STRING(8),
        allowNull: false,
        defaultValue: 'CNY',
      },
      is_deleted: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    })

    await queryInterface.createTable('Categories', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      ledger_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Ledgers',
          key: 'id',
        },
      },
      client_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      kind: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      color: {
        type: Sequelize.STRING(32),
        allowNull: true,
      },
      is_deleted: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    })
    await queryInterface.addIndex('Categories', ['ledger_id', 'client_id'], {
      unique: true,
      name: 'categories_ledger_client_id_unique',
    })

    await queryInterface.createTable('Transactions', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      ledger_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Ledgers',
          key: 'id',
        },
      },
      account_id: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },
      category_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'Categories',
          key: 'id',
        },
      },
      client_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      kind: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      amount: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: false,
      },
      note: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      occurred_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      is_deleted: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    })
    await queryInterface.addIndex('Transactions', ['ledger_id', 'client_id'], {
      unique: true,
      name: 'transactions_ledger_client_id_unique',
    })

    await queryInterface.createTable('Users', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      password_hash: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      current_ledger_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'Ledgers',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    })

    await queryInterface.createTable('RefreshTokens', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      token_hash: {
        type: Sequelize.STRING(64),
        allowNull: false,
        unique: true,
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      revoked_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    })
    await queryInterface.addIndex('RefreshTokens', ['user_id', 'revoked_at'])

    await queryInterface.createTable('Articles', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      title: {
        type: Sequelize.STRING,
      },
      content: {
        type: Sequelize.TEXT,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    })
  },

  async down() {
    throw new Error(
      '20260513170000-recreate-core-tables-uuid-mysql: down() 会丢失 UUID 结构，已禁用。如需回滚请从备份恢复数据库。',
    )
  },
}
