export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Accounts', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      ledger_id: {
        type: Sequelize.INTEGER,
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
      type: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      currency: {
        type: Sequelize.STRING(8),
        allowNull: false,
        defaultValue: 'CNY',
      },
      opening_balance: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0,
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

    await queryInterface.addIndex('Accounts', ['ledger_id', 'client_id'], {
      unique: true,
      name: 'accounts_ledger_client_id_unique',
    })
  },
  async down(queryInterface) {
    await queryInterface.dropTable('Accounts')
  },
}
