import { Model } from 'sequelize'

export default (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      User.belongsTo(models.Ledger, {
        foreignKey: 'current_ledger_id',
        as: 'currentLedger',
      })
      User.hasMany(models.RefreshToken, {
        foreignKey: 'user_id',
        as: 'refreshTokens',
      })
    }

    static sanitize(user) {
      if (!user) {
        return null
      }

      const source = typeof user.get === 'function' ? user.get() : user

      return {
        id: source.id,
        email: source.email,
        name: source.name,
        currentLedgerId: source.current_ledger_id ?? source.currentLedgerId ?? null,
        createdAt: source.createdAt,
        updatedAt: source.updatedAt,
      }
    }

    static async updateProfile(id, values) {
      const user = await User.findByPk(id)
      if (!user) {
        return null
      }

      const updates = {}
      if (typeof values.email === 'string') {
        updates.email = values.email.trim().toLowerCase()
      }
      if (typeof values.name === 'string') {
        updates.name = values.name.trim()
      }

      if (typeof user.update === 'function') {
        await user.update(updates)
        return user
      }

      await User.update(updates, { where: { id } })
      return User.findByPk(id)
    }

    static async updatePassword(id, passwordHash) {
      const user = await User.findByPk(id)
      if (!user) {
        return null
      }

      if (typeof user.update === 'function') {
        await user.update({ passwordHash })
        return user
      }

      await User.update({ passwordHash }, { where: { id } })
      return User.findByPk(id)
    }
  }

  User.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        set(value) {
          this.setDataValue('email', String(value || '').trim().toLowerCase())
        },
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        set(value) {
          this.setDataValue('name', String(value || '').trim())
        },
      },
      passwordHash: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'password_hash',
      },
      current_ledger_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'User',
      tableName: 'Users',
      indexes: [
        {
          unique: true,
          fields: ['email'],
        },
      ],
    },
  )

  return User
}
