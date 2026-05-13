import { Model, Op } from 'sequelize'

export default (sequelize, DataTypes) => {
  class RefreshToken extends Model {
    static associate(models) {
      RefreshToken.belongsTo(models.User, {
        foreignKey: 'user_id',
        as: 'user',
      })
    }

    static async findActiveByTokenHash(tokenHash) {
      return RefreshToken.findOne({
        where: {
          tokenHash,
          revokedAt: null,
          expiresAt: {
            [Op.gt]: new Date(),
          },
        },
      })
    }

    static async revokeByTokenHash(tokenHash) {
      await RefreshToken.update(
        {
          revokedAt: new Date(),
        },
        {
          where: {
            tokenHash,
            revokedAt: null,
          },
        },
      )
    }

    static async revokeAllForUser(userId) {
      await RefreshToken.update(
        {
          revokedAt: new Date(),
        },
        {
          where: {
            userId: String(userId),
            revokedAt: null,
          },
        },
      )
    }
  }

  RefreshToken.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'user_id',
      },
      tokenHash: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true,
        field: 'token_hash',
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'expires_at',
      },
      revokedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'revoked_at',
      },
    },
    {
      sequelize,
      modelName: 'RefreshToken',
      tableName: 'RefreshTokens',
      indexes: [
        {
          unique: true,
          fields: ['token_hash'],
        },
        {
          fields: ['user_id', 'revoked_at'],
        },
      ],
    },
  )

  return RefreshToken
}
