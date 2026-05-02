const { v4: uuidv4 } = require('uuid');

const { KYC_STATUSES } = require('../utils/constants');

module.exports = (sequelize, DataTypes) =>
  sequelize.define(
    'Driver',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: uuidv4
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
        field: 'user_id'
      },
      fullName: {
        type: DataTypes.STRING(120),
        allowNull: true,
        field: 'full_name'
      },
      vehicleType: {
        type: DataTypes.STRING(80),
        allowNull: true,
        field: 'vehicle_type'
      },
      vehicleNumber: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'vehicle_number'
      },
      licenseNumber: {
        type: DataTypes.STRING(80),
        allowNull: true,
        field: 'license_number'
      },
      licenseImageUrl: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'license_image_url'
      },
      rcImageUrl: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'rc_image_url'
      },
      profilePhotoUrl: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'profile_photo_url'
      },
      isProfileComplete: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_profile_complete'
      },
      isApproved: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_approved'
      },
      kycStatus: {
        type: DataTypes.ENUM(
          KYC_STATUSES.PENDING,
          KYC_STATUSES.APPROVED,
          KYC_STATUSES.REJECTED
        ),
        allowNull: false,
        defaultValue: KYC_STATUSES.PENDING,
        field: 'kyc_status'
      },
      isOnline: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_online'
      },
      rating: {
        type: DataTypes.DECIMAL(3, 2),
        allowNull: false,
        defaultValue: 5,
        field: 'rating'
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'created_at'
      }
    },
    {
      tableName: 'drivers',
      timestamps: false,
      indexes: [
        {
          unique: true,
          fields: ['user_id']
        },
        {
          fields: ['is_online', 'kyc_status']
        },
        {
          fields: ['is_profile_complete', 'is_approved']
        },
        {
          fields: ['created_at']
        }
      ]
    }
  );
