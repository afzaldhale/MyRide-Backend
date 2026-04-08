const sequelize = require('../db/sequelize');
const rideRepository = require('../repositories/ride.repository');
const ApiError = require('../utils/apiError');
const matchingService = require('./matching.service');
const { RIDE_STATUSES } = require('../utils/constants');
const generateRideOtp = require('../utils/generateRideOtp');

const requestRide = async (user, payload) => {
  const ride = await rideRepository.createRide({
    riderId: user.id,
    pickupLat: payload.pickup_lat,
    pickupLng: payload.pickup_lng,
    dropLat: payload.drop_lat,
    dropLng: payload.drop_lng,
    fare: payload.fare || null,
    rideOtp: generateRideOtp()
  });

  const hydratedRide = await rideRepository.findById(ride.id);
  const matching = await matchingService.startMatching(hydratedRide);

  return {
    ride: hydratedRide,
    matching
  };
};

const getMyRides = (user) => rideRepository.getRidesByRiderId(user.id);

const cancelRide = async (user, rideId) =>
  sequelize.transaction(async (transaction) => {
    const ride = await rideRepository.findById(rideId, transaction);

    if (!ride || ride.riderId !== user.id) {
      throw new ApiError(404, 'Ride not found');
    }

    if (
      ![RIDE_STATUSES.REQUESTED, RIDE_STATUSES.ACCEPTED].includes(ride.status)
    ) {
      throw new ApiError(409, `Ride cannot be cancelled when status is ${ride.status}`);
    }

    await ride.update(
      {
        status: RIDE_STATUSES.CANCELLED
      },
      { transaction }
    );

    return rideRepository.findById(rideId, transaction);
  }).then((ride) => {
    matchingService.cancelMatching(ride);
    return ride;
  });

module.exports = {
  requestRide,
  getMyRides,
  cancelRide
};
