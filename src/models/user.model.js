const { v4: uuidv4 } = require('uuid');

const { USER_ROLES } = require('../utils/constants');

module.exports = (sequelize, DataTypes) =>
  sequelize.define(
    'User',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: uuidv4
      },
      phoneNumber: {
        type: DataTypes.STRING(20),
        allowNull: false,
        unique: true,
        field: 'phone_number'
      },
      role: {
        type: DataTypes.ENUM(USER_ROLES.RIDER, USER_ROLES.DRIVER),
        allowNull: false
      },
      name: {
        type: DataTypes.STRING(120),
        allowNull: true
      },
      profilePhoto: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'profile_photo'
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'created_at'
      }
    },
    {
      tableName: 'users',
      timestamps: false,
      indexes: [
        {
          unique: true,
          fields: ['phone_number']
        }
      ]
    }
  );
