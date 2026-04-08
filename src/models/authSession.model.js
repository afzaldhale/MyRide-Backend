const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) =>
  sequelize.define(
    'AuthSession',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: uuidv4
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'user_id'
      },
      refreshTokenHash: {
        type: DataTypes.STRING(128),
        allowNull: false,
        field: 'refresh_token_hash'
      },
      deviceId: {
        type: DataTypes.STRING(191),
        allowNull: false,
        field: 'device_id'
      },
      deviceType: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'unknown',
        field: 'device_type'
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
      ipAddress: {
        type: DataTypes.STRING(64),
        allowNull: true,
        field: 'ip_address'
      },
      userAgent: {
        type: DataTypes.STRING(512),
        allowNull: true,
        field: 'user_agent'
      },
      lastUsedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'last_used_at'
      },
      lastRotatedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'last_rotated_at'
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'expires_at'
      },
      revokedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'revoked_at'
      },
      invalidatedReason: {
        type: DataTypes.STRING(64),
        allowNull: true,
        field: 'invalidated_reason'
      },
      reuseDetectedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'reuse_detected_at'
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'created_at'
      }
    },
    {
      tableName: 'auth_sessions',
      timestamps: false,
      indexes: [
        { fields: ['user_id', 'revoked_at', 'expires_at'] },
        { fields: ['device_id', 'created_at'] },
        { fields: ['expires_at'] },
        { fields: ['revoked_at'] },
        { fields: ['reuse_detected_at'] },
        { unique: true, fields: ['refresh_token_hash'] }
      ]
    }
  );
