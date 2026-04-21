const { Driver, Ride, User } = require('../models');
const { RIDE_STATUSES } = require('../utils/constants');

const createRide = (payload, transaction) =>
  Ride.create(payload, {
    transaction
  });

const findById = (id, transaction) =>
  Ride.findByPk(id, {
    include: [
      {
        model: User,
        as: 'rider',
        attributes: ['id', 'phoneNumber', 'name']
      },
      {
        model: Driver,
        as: 'driver',
        attributes: ['id', 'userId', 'vehicleType', 'vehicleNumber', 'rating']
      }
    ],
    transaction
  });

const getRidesByRiderId = (riderId) =>
  Ride.findAll({
    where: { riderId },
    include: [
      {
        model: Driver,
        as: 'driver',
        attributes: ['id', 'userId', 'vehicleType', 'vehicleNumber', 'rating']
      }
    ],
    order: [['createdAt', 'DESC']]
  });

const getAvailableRides = () =>
  Ride.findAll({
    where: {
      status: RIDE_STATUSES.REQUESTED,
      driverId: null
    },
    include: [
      {
        model: User,
        as: 'rider',
        attributes: ['id', 'phoneNumber', 'name']
      }
    ],
    order: [['createdAt', 'ASC']]
  });

const updateRideStatus = (rideId, status, transaction) =>
  Ride.update(
    { status },
    { where: { id: rideId }, transaction }
  );

module.exports = {
  createRide,
  findById,
  getRidesByRiderId,
  getAvailableRides,
  updateRideStatus
};
