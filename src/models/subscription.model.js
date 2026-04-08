const { v4: uuidv4 } = require('uuid');

const { SUBSCRIPTION_STATUSES } = require('../utils/constants');

module.exports = (sequelize, DataTypes) =>
  sequelize.define(
    'Subscription',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: uuidv4
      },
      driverId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'driver_id'
      },
      planName: {
        type: DataTypes.STRING(120),
        allowNull: false,
        field: 'plan_name'
      },
      price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
      },
      startDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        field: 'start_date'
      },
      endDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        field: 'end_date'
      },
      status: {
        type: DataTypes.ENUM(
          SUBSCRIPTION_STATUSES.ACTIVE,
          SUBSCRIPTION_STATUSES.EXPIRED,
          SUBSCRIPTION_STATUSES.CANCELLED
        ),
        allowNull: false,
        defaultValue: SUBSCRIPTION_STATUSES.ACTIVE
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'created_at'
      }
    },
    {
      tableName: 'subscriptions',
      timestamps: false
    }
  );
