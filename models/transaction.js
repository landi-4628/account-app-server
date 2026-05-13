import { Model } from 'sequelize'

export default (sequelize, DataTypes) => {
  class Transaction extends Model {
    static associate(models) {
      Transaction.belongsTo(models.Ledger, { foreignKey: 'ledger_id', as: 'ledger' })
      Transaction.belongsTo(models.Account, { foreignKey: 'account_id', as: 'account' })
      Transaction.belongsTo(models.Category, { foreignKey: 'category_id', as: 'category' })
    }
  }

  Transaction.init(
    {
      ledger_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      account_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      category_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      client_id: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      kind: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      amount: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: false,
      },
      note: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      occurred_at: {
        type: DataTypes.DATE,
        allowNull: false,
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
      modelName: 'Transaction',
      tableName: 'Transactions',
      indexes: [
        {
          unique: true,
          fields: ['ledger_id', 'client_id'],
        },
      ],
    },
  )

  return Transaction
}
