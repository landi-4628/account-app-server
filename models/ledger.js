import { Model } from 'sequelize'

export default (sequelize, DataTypes) => {
  class Ledger extends Model {
    static associate(models) {
      Ledger.hasMany(models.Account, { foreignKey: 'ledger_id', as: 'accounts' })
      Ledger.hasMany(models.Category, { foreignKey: 'ledger_id', as: 'categories' })
      Ledger.hasMany(models.Transaction, { foreignKey: 'ledger_id', as: 'transactions' })
    }
  }

  Ledger.init(
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      client_id: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      base_currency: {
        type: DataTypes.STRING(8),
        allowNull: false,
        defaultValue: 'CNY',
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
      modelName: 'Ledger',
      tableName: 'Ledgers',
    },
  )

  return Ledger
}
