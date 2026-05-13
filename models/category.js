import { Model } from 'sequelize'

export default (sequelize, DataTypes) => {
  class Category extends Model {
    static associate(models) {
      Category.belongsTo(models.Ledger, { foreignKey: 'ledger_id', as: 'ledger' })
      Category.hasMany(models.Transaction, { foreignKey: 'category_id', as: 'transactions' })
    }
  }

  Category.init(
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
      kind: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      color: {
        type: DataTypes.STRING(32),
        allowNull: true,
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
      modelName: 'Category',
      tableName: 'Categories',
      indexes: [
        {
          unique: true,
          fields: ['ledger_id', 'client_id'],
        },
      ],
    },
  )

  return Category
}
