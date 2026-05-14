import { Model } from 'sequelize'

export default (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      User.belongsTo(models.Ledger, {
        foreignKey: 'current_ledger_id',
        as: 'currentLedger',
      })
      User.hasMany(models.Ledger, {
        foreignKey: 'owner_user_id',
        as: 'ownedLedgers',
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

    static defaultLedgerClientId(userId) {
      return `default-ledger:${userId}`
    }

    static defaultLedgerName(user) {
      const source = typeof user?.get === 'function' ? user.get() : user
      const normalizedName = String(source?.name || '').trim()
      return normalizedName ? `${normalizedName} Ledger` : 'Personal Ledger'
    }

    static async ensureCurrentLedger(user) {
      if (!user) {
        return null
      }

      const source = typeof user.get === 'function' ? user.get() : user
      const currentLedgerId = source.current_ledger_id ?? source.currentLedgerId ?? null
      if (currentLedgerId) {
        return user
      }

      const Ledger = User.sequelize.models.Ledger
      const clientId = User.defaultLedgerClientId(source.id)
      const [ledger] = await Ledger.findOrCreate({
        where: { client_id: clientId },
        defaults: {
          client_id: clientId,
          name: User.defaultLedgerName(source),
          owner_user_id: source.id,
        },
      })

      const nextLedgerId = ledger.id

      if (typeof user.update === 'function') {
        await user.update({ current_ledger_id: nextLedgerId })
        return user
      }

      await User.update({ current_ledger_id: nextLedgerId }, { where: { id: source.id } })
      return (await User.findByPk(source.id)) ?? { ...source, current_ledger_id: nextLedgerId }
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
          this.setDataValue(
            'email',
            String(value || '')
              .trim()
              .toLowerCase(),
          )
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
