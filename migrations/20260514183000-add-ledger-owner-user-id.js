export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Ledgers', 'owner_user_id', {
      type: Sequelize.UUID,
      allowNull: true,
    })

    await queryInterface.addIndex('Ledgers', ['owner_user_id'], {
      name: 'ledgers_owner_user_id_idx',
    })

    await queryInterface.addConstraint('Ledgers', {
      fields: ['owner_user_id'],
      type: 'foreign key',
      name: 'ledgers_owner_user_id_fkey',
      references: {
        table: 'Users',
        field: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    })

    await queryInterface.sequelize.query(`
      UPDATE \`Ledgers\` AS \`l\`
      INNER JOIN \`Users\` AS \`u\` ON \`u\`.\`current_ledger_id\` = \`l\`.\`id\`
      SET \`l\`.\`owner_user_id\` = \`u\`.\`id\`
      WHERE \`l\`.\`owner_user_id\` IS NULL
    `)

    await queryInterface.sequelize.query(`
      UPDATE \`Ledgers\` AS \`l\`
      INNER JOIN \`Users\` AS \`u\` ON \`l\`.\`client_id\` = CONCAT('default-ledger:', \`u\`.\`id\`)
      SET \`l\`.\`owner_user_id\` = \`u\`.\`id\`
      WHERE \`l\`.\`owner_user_id\` IS NULL
    `)
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('Ledgers', 'ledgers_owner_user_id_fkey')
    await queryInterface.removeIndex('Ledgers', 'ledgers_owner_user_id_idx')
    await queryInterface.removeColumn('Ledgers', 'owner_user_id')
  },
}
