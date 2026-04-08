const sequelize = require('../db/sequelize');
const driverRepository = require('../repositories/driver.repository');
const rideRepository = require('../repositories/ride.repository');
const userRepository = require('../repositories/user.repository');
const ApiError = require('../utils/apiError');
const matchingService = require('./matching.service');
const realtimeGateway = require('./realtimeGateway.service');
const locationStore = require('./locationStore.service');
const { KYC_STATUSES, RIDE_STATUSES, SOCKET_EVENTS } = require('../utils/constants');

const getDriverProfileOrFail = async (userId, transaction) => {
  const driverProfile = await driverRepository.findByUserId(userId, transaction);

  if (!driverProfile) {
    throw new ApiError(404, 'Driver profile not found');
  }

  return driverProfile;
};

const submitKyc = async (user, payload) => {
  const driverProfile = await getDriverProfileOrFail(user.id);

  await driverRepository.updateDriverProfile(driverProfile, {
    vehicleType: payload.vehicle_type,
    vehicleNumber: payload.vehicle_number,
    licenseNumber: payload.license_number,
    kycStatus: KYC_STATUSES.PENDING
  });

  const updatedDriver = await driverRepository.findByUserId(user.id);
  realtimeGateway.syncDriverSession(updatedDriver.id, {
    kycStatus: updatedDriver.kycStatus
  });
  await userRepository.invalidateAuthUserCache(user.id);

  return updatedDriver;
};

const setOnlineStatus = async (user, isOnline) => {
  const driverProfile = await getDriverProfileOrFail(user.id);
  await driverRepository.updateDriverProfile(driverProfile, { isOnline });
  const updatedDriver = await driverRepository.findByUserId(user.id);

  realtimeGateway.syncDriverSession(updatedDriver.id, {
    isOnline: updatedDriver.isOnline
  });

  if (!isOnline) {
    await locationStore.removeDriverLocation(updatedDriver.id).catch(() => null);
  }

  await userRepository.invalidateAuthUserCache(user.id);

  return updatedDriver;
};

const getAvailableRides = async () => rideRepository.getAvailableRides();

const acceptRide = async (user, rideId) =>
  sequelize.transaction(async (transaction) => {
    const driverProfile = await getDriverProfileOrFail(user.id, transaction);
    const ride = await rideRepository.findById(rideId, transaction);

    if (!driverProfile.isOnline) {
      throw new ApiError(409, 'Driver must be online before accepting rides');
    }

    if (!ride) {
      throw new ApiError(404, 'Ride not found');
    }

    if (ride.status !== RIDE_STATUSES.REQUESTED || ride.driverId) {
      throw new ApiError(409, 'Ride is no longer available');
    }

    if (driverProfile.kycStatus !== KYC_STATUSES.APPROVED) {
      throw new ApiError(403, 'Only approved KYC drivers can accept rides');
    }

    await ride.update(
      {
        driverId: driverProfile.id,
        status: RIDE_STATUSES.ACCEPTED
      },
      { transaction }
    );

    return rideRepository.findById(rideId, transaction);
  }).then(async (ride) => {
    await matchingService.markRideAccepted(ride);
    return ride;
  });

const startRide = async (user, rideId, rideOtp) =>
  sequelize.transaction(async (transaction) => {
    const driverProfile = await getDriverProfileOrFail(user.id, transaction);
    const ride = await rideRepository.findById(rideId, transaction);

    if (!ride || ride.driverId !== driverProfile.id) {
      throw new ApiError(404, 'Assigned ride not found');
    }

    if (ride.status !== RIDE_STATUSES.ACCEPTED) {
      throw new ApiError(409, `Ride cannot be started when status is ${ride.status}`);
    }

    if (ride.rideOtp !== rideOtp) {
      throw new ApiError(400, 'Invalid ride OTP');
    }

    await ride.update(
      {
        status: RIDE_STATUSES.STARTED
      },
      { transaction }
    );

    return rideRepository.findById(rideId, transaction);
  }).then((ride) => {
    matchingService.emitRideStatusUpdate(SOCKET_EVENTS.RIDE_START, ride);
    return ride;
  });

const endRide = async (user, rideId) =>
  sequelize.transaction(async (transaction) => {
    const driverProfile = await getDriverProfileOrFail(user.id, transaction);
    const ride = await rideRepository.findById(rideId, transaction);

    if (!ride || ride.driverId !== driverProfile.id) {
      throw new ApiError(404, 'Assigned ride not found');
    }

    if (ride.status !== RIDE_STATUSES.STARTED) {
      throw new ApiError(409, `Ride cannot be completed when status is ${ride.status}`);
    }

    await ride.update(
      {
        status: RIDE_STATUSES.COMPLETED
      },
      { transaction }
    );

    return rideRepository.findById(rideId, transaction);
  }).then((ride) => {
    matchingService.emitRideStatusUpdate(SOCKET_EVENTS.RIDE_END, ride);
    return ride;
  });

module.exports = {
  submitKyc,
  setOnlineStatus,
  getAvailableRides,
  acceptRide,
  startRide,
  endRide
};
