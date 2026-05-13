export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Categories', {
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
  },
  async down(queryInterface) {
    await queryInterface.dropTable('Categories')
  },
}
