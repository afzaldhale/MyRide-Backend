const sequelize = require('../db/sequelize');
const rideRepository = require('../repositories/ride.repository');
const ApiError = require('../utils/apiError');
const matchingService = require('./matching.service');
const { RIDE_STATUSES } = require('../utils/constants');
const generateRideOtp = require('../utils/generateRideOtp');
const logger = require('../config/logger');

const VALID_VEHICLE_TYPES = ['auto', 'economy', 'comfort', 'premium', 'xl', 'mini', 'sedan'];

const requestRide = async (user, payload) => {
  logger.info('Ride request initiated', {
    riderId: user.id,
    payload: {
      pickup_lat: payload.pickup_lat,
      pickup_lng: payload.pickup_lng,
      drop_lat: payload.drop_lat,
      drop_lng: payload.drop_lng,
      fare: payload.fare,
      vehicleType: payload.vehicleType
    }
  });

  try {
    // Validate vehicle type if provided
    const vehicleType = payload.vehicleType?.toLowerCase();
    if (vehicleType && !VALID_VEHICLE_TYPES.includes(vehicleType)) {
      logger.warn('Invalid vehicle type requested', {
        riderId: user.id,
        vehicleType: payload.vehicleType
      });
      throw new ApiError(400, `Invalid vehicle type: ${payload.vehicleType}. Valid types: ${VALID_VEHICLE_TYPES.join(', ')}`);
    }

    const ride = await rideRepository.createRide({
      riderId: user.id,
      pickupLat: payload.pickup_lat,
      pickupLng: payload.pickup_lng,
      dropLat: payload.drop_lat,
      dropLng: payload.drop_lng,
      fare: payload.fare || null,
      vehicleType: vehicleType || 'economy', // Default to economy if not specified
      rideOtp: generateRideOtp()
    });

    logger.info('Ride created in database', {
      rideId: ride.id,
      riderId: user.id,
      vehicleType: vehicleType || 'economy'
    });

    const hydratedRide = await rideRepository.findById(ride.id);
    
    logger.info('Starting driver matching', {
      rideId: hydratedRide.id,
      pickupLat: hydratedRide.pickupLat,
      pickupLng: hydratedRide.pickupLng,
      vehicleType: hydratedRide.vehicleType
    });

    const matching = await matchingService.startMatching(hydratedRide);

    logger.info('Ride request completed successfully', {
      rideId: hydratedRide.id,
      matchingStatus: matching.status,
      matchedDrivers: matching.matchedDrivers
    });

    return {
      ride: hydratedRide,
      matching
    };
  } catch (error) {
    logger.error('Ride request failed', {
      riderId: user.id,
      error: error.message,
      stack: error.stack,
      payload: {
        pickup_lat: payload.pickup_lat,
        pickup_lng: payload.pickup_lng,
        drop_lat: payload.drop_lat,
        drop_lng: payload.drop_lng
      }
    });
    throw error;
  }
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
