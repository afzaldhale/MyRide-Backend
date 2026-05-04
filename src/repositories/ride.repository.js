const { Op, Driver, Ride, User } = require('../models');
const { RIDE_STATUSES } = require('../utils/constants');

const createRide = (payload, transaction) =>
  Ride.create(payload, {
    transaction
  });

const rideIncludes = [
  {
    model: User,
    as: 'rider',
    attributes: ['id', 'phoneNumber', 'name']
  },
  {
    model: Driver,
    as: 'driver',
    attributes: ['id', 'userId', 'vehicleType', 'vehicleNumber', 'rating'],
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'phoneNumber']
      }
    ]
  }
];

const findById = (id, transaction) =>
  Ride.findByPk(id, {
    include: rideIncludes,
    transaction
  });

const findByIdForUpdate = (id, transaction) =>
  Ride.findByPk(id, {
    include: rideIncludes,
    transaction,
    lock: transaction.LOCK.UPDATE
  });

const ACTIVE_RIDE_STATUSES = [
  RIDE_STATUSES.REQUESTED,
  RIDE_STATUSES.ACCEPTED,
  RIDE_STATUSES.DRIVER_ARRIVING,
  RIDE_STATUSES.ARRIVED,
  RIDE_STATUSES.IN_PROGRESS
];

const getRidesByRiderId = (riderId) =>
  Ride.findAll({
    where: { riderId },
    include: rideIncludes,
    order: [['createdAt', 'DESC']]
  });

const getAvailableRides = () =>
  Ride.findAll({
    where: {
      status: RIDE_STATUSES.REQUESTED,
      driverId: null
    },
    include: rideIncludes,
    order: [['createdAt', 'ASC']]
  });

const getDriverPendingRides = async (driverId) => {
  const rides = await getAvailableRides();
  return rides.filter((ride) => !(ride.rejectedDriverIds || []).includes(driverId));
};

const getActiveRideByDriverId = (driverId) =>
  Ride.findOne({
    where: {
      driverId,
      status: {
        [Op.in]: ACTIVE_RIDE_STATUSES
      }
    },
    include: rideIncludes,
    order: [['updatedAt', 'DESC']]
  });

const getActiveRideByRiderId = (riderId) =>
  Ride.findOne({
    where: {
      riderId,
      status: {
        [Op.in]: ACTIVE_RIDE_STATUSES
      }
    },
    include: rideIncludes,
    order: [['updatedAt', 'DESC']]
  });

const updateRide = (ride, payload, transaction) => ride.update(payload, { transaction });

module.exports = {
  createRide,
  findById,
  findByIdForUpdate,
  getRidesByRiderId,
  getAvailableRides,
  getDriverPendingRides,
  getActiveRideByDriverId,
  getActiveRideByRiderId,
  updateRide
};
