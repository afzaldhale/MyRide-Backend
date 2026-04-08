const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) =>
  sequelize.define(
    'OtpAttempt',
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
      ipAddress: {
        type: DataTypes.STRING(64),
        allowNull: false,
        field: 'ip_address'
      },
      deviceId: {
        type: DataTypes.STRING(191),
        allowNull: false,
        field: 'device_id'
      },
      attemptType: {
        type: DataTypes.ENUM('send', 'verify'),
        allowNull: false,
        field: 'attempt_type'
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'created_at'
      }
    },
    {
      tableName: 'otp_attempts',
      timestamps: false,
      indexes: [
        { fields: ['phone_number', 'created_at'] },
        { fields: ['ip_address', 'created_at'] },
        { fields: ['device_id', 'created_at'] },
        { fields: ['attempt_type', 'created_at'] }
      ]
    }
  );
