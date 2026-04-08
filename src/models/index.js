const { DataTypes, Op } = require('sequelize');

const sequelize = require('../db/sequelize');
const defineUser = require('./user.model');
const defineDriver = require('./driver.model');
const defineRide = require('./ride.model');
const defineSubscription = require('./subscription.model');
const defineOtpAttempt = require('./otpAttempt.model');
const defineOtpSession = require('./otpSession.model');
const defineOtpLog = require('./otpLog.model');
const defineAuthSession = require('./authSession.model');

const User = defineUser(sequelize, DataTypes);
const Driver = defineDriver(sequelize, DataTypes);
const Ride = defineRide(sequelize, DataTypes);
const Subscription = defineSubscription(sequelize, DataTypes);
const OtpAttempt = defineOtpAttempt(sequelize, DataTypes);
const OtpSession = defineOtpSession(sequelize, DataTypes);
const OtpLog = defineOtpLog(sequelize, DataTypes);
const AuthSession = defineAuthSession(sequelize, DataTypes);

User.hasOne(Driver, {
  foreignKey: {
    name: 'userId',
    field: 'user_id'
  },
  as: 'driverProfile'
});

Driver.belongsTo(User, {
  foreignKey: {
    name: 'userId',
    field: 'user_id'
  },
  as: 'user'
});

User.hasMany(AuthSession, {
  foreignKey: {
    name: 'userId',
    field: 'user_id'
  },
  as: 'authSessions'
});

AuthSession.belongsTo(User, {
  foreignKey: {
    name: 'userId',
    field: 'user_id'
  },
  as: 'user'
});

User.hasMany(Ride, {
  foreignKey: {
    name: 'riderId',
    field: 'rider_id'
  },
  as: 'rides'
});

Ride.belongsTo(User, {
  foreignKey: {
    name: 'riderId',
    field: 'rider_id'
  },
  as: 'rider'
});

Driver.hasMany(Ride, {
  foreignKey: {
    name: 'driverId',
    field: 'driver_id'
  },
  as: 'rides'
});

Ride.belongsTo(Driver, {
  foreignKey: {
    name: 'driverId',
    field: 'driver_id'
  },
  as: 'driver'
});

Driver.hasMany(Subscription, {
  foreignKey: {
    name: 'driverId',
    field: 'driver_id'
  },
  as: 'subscriptions'
});

Subscription.belongsTo(Driver, {
  foreignKey: {
    name: 'driverId',
    field: 'driver_id'
  },
  as: 'driver'
});

module.exports = {
  sequelize,
  Op,
  User,
  Driver,
  Ride,
  Subscription,
  OtpAttempt,
  OtpSession,
  OtpLog,
  AuthSession
};
