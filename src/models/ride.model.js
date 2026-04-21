const { v4: uuidv4 } = require('uuid');

const { RIDE_STATUSES } = require('../utils/constants');

module.exports = (sequelize, DataTypes) =>
  sequelize.define(
    'Ride',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: uuidv4
      },
      riderId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'rider_id'
      },
      driverId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'driver_id'
      },
      pickupLat: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: false,
        field: 'pickup_lat'
      },
      pickupLng: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: false,
        field: 'pickup_lng'
      },
      dropLat: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: false,
        field: 'drop_lat'
      },
      dropLng: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: false,
        field: 'drop_lng'
      },
      status: {
        type: DataTypes.ENUM(
          RIDE_STATUSES.REQUESTED,
          RIDE_STATUSES.ACCEPTED,
          RIDE_STATUSES.STARTED,
          RIDE_STATUSES.COMPLETED,
          RIDE_STATUSES.CANCELLED
        ),
        allowNull: false,
        defaultValue: RIDE_STATUSES.REQUESTED
      },
      fare: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
      },
      vehicleType: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: 'economy',
        field: 'vehicle_type'
      },
      rideOtp: {
        type: DataTypes.STRING(10),
        allowNull: false,
        field: 'ride_otp'
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'created_at'
      }
    },
    {
      tableName: 'rides',
      timestamps: false,
      indexes: [
        {
          fields: ['rider_id', 'created_at']
        },
        {
          fields: ['driver_id', 'status']
        },
        {
          fields: ['status', 'created_at']
        }
      ]
    }
  );
