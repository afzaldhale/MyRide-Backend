const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) =>
  sequelize.define(
    'OtpLog',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: uuidv4
      },
      phone: {
        type: DataTypes.STRING(20),
        allowNull: false
      },
      ip: {
        type: DataTypes.STRING(64),
        allowNull: false
      },
      device: {
        type: DataTypes.STRING(191),
        allowNull: false
      },
      status: {
        type: DataTypes.STRING(80),
        allowNull: false
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'created_at'
      }
    },
    {
      tableName: 'otp_logs',
      timestamps: false,
      indexes: [
        { fields: ['phone', 'created_at'] },
        { fields: ['ip', 'created_at'] },
        { fields: ['device', 'created_at'] },
        { fields: ['status', 'created_at'] }
      ]
    }
  );
