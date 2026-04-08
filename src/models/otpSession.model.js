const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) =>
  sequelize.define(
    'OtpSession',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: uuidv4
      },
      phoneNumber: {
        type: DataTypes.STRING(20),
        allowNull: false,
        field: 'phone_number'
      },
      verificationId: {
        type: DataTypes.STRING(191),
        allowNull: false,
        field: 'verification_id'
      },
      deviceId: {
        type: DataTypes.STRING(191),
        allowNull: false,
        field: 'device_id'
      },
      platform: {
        type: DataTypes.STRING(32),
        allowNull: false
      },
      appVersion: {
        type: DataTypes.STRING(32),
        allowNull: false,
        field: 'app_version'
      },
      attemptCount: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
        field: 'attempt_count'
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'created_at'
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'expires_at'
      }
    },
    {
      tableName: 'otp_sessions',
      timestamps: false,
      indexes: [
        { fields: ['phone_number', 'created_at'] },
        { fields: ['device_id', 'created_at'] },
        { fields: ['expires_at'] },
        { unique: true, fields: ['verification_id'] }
      ]
    }
  );
