import { Model } from 'sequelize'

export default (sequelize, DataTypes) => {
  class Account extends Model {
    static associate(models) {
      Account.belongsTo(models.Ledger, { foreignKey: 'ledger_id', as: 'ledger' })
      Account.hasMany(models.Transaction, { foreignKey: 'account_id', as: 'transactions' })
    }
  }

  Account.init(
    {
      ledger_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      client_id: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      type: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      currency: {
        type: DataTypes.STRING(8),
        allowNull: false,
        defaultValue: 'CNY',
      },
      opening_balance: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0,
      },
      is_deleted: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Account',
      tableName: 'Accounts',
      indexes: [
        {
          unique: true,
          fields: ['ledger_id', 'client_id'],
        },
      ],
    },
  )

  return Account
}
