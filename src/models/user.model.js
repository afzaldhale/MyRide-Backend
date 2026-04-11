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
        allowNull: true, // Now nullable for Google users
        field: 'phone_number'
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: true,
        unique: true,
        validate: {
          isEmail: true
        }
      },
      googleId: {
        type: DataTypes.STRING(255),
        allowNull: true,
        unique: true,
        field: 'google_id'
      },
      authProvider: {
        type: DataTypes.ENUM('phone', 'google'),
        allowNull: false,
        defaultValue: 'phone',
        field: 'auth_provider'
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
          fields: ['phone_number'],
          where: {
            phone_number: {
              [sequelize.Sequelize.Op.ne]: null
            }
          }
        },
        {
          unique: true,
          fields: ['email'],
          where: {
            email: {
              [sequelize.Sequelize.Op.ne]: null
            }
          }
        },
        {
          unique: true,
          fields: ['google_id'],
          where: {
            google_id: {
              [sequelize.Sequelize.Op.ne]: null
            }
          }
        }
      ],
      validate: {
        // Ensure either phone_number or email/google_id is provided
        authFields() {
          if (this.authProvider === 'phone' && !this.phoneNumber) {
            throw new Error('Phone number is required for phone authentication');
          }
          if (this.authProvider === 'google' && !this.email && !this.googleId) {
            throw new Error('Email or Google ID is required for Google authentication');
          }
        }
      }
    }
  );
