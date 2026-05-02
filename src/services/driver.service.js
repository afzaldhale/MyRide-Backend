const sequelize = require('../db/sequelize');
const driverRepository = require('../repositories/driver.repository');
const rideRepository = require('../repositories/ride.repository');
const userRepository = require('../repositories/user.repository');
const ApiError = require('../utils/apiError');
const matchingService = require('./matching.service');
const realtimeGateway = require('./realtimeGateway.service');
const locationStore = require('./locationStore.service');
const { KYC_STATUSES, RIDE_STATUSES, SOCKET_EVENTS } = require('../utils/constants');
const { assertValidIndianPhone } = require('../utils/phone');

const getDriverProfileOrFail = async (userId, transaction) => {
  const driverProfile = await driverRepository.findByUserId(userId, transaction);

  if (!driverProfile) {
    throw new ApiError(404, 'Driver profile not found');
  }

  return driverProfile;
};

const mapDriverProfile = (driverProfile) => ({
  id: driverProfile.id,
  userId: driverProfile.userId,
  fullName: driverProfile.fullName,
  vehicleType: driverProfile.vehicleType,
  vehicleNumber: driverProfile.vehicleNumber,
  licenseNumber: driverProfile.licenseNumber,
  licenseImageUrl: driverProfile.licenseImageUrl,
  rcImageUrl: driverProfile.rcImageUrl,
  profilePhotoUrl: driverProfile.profilePhotoUrl,
  isProfileComplete: Boolean(driverProfile.isProfileComplete),
  isApproved: Boolean(driverProfile.isApproved),
  kycStatus: driverProfile.kycStatus,
  isOnline: Boolean(driverProfile.isOnline),
  createdAt: driverProfile.createdAt
});

const buildProfileResponse = (driverProfile) => ({
  isProfileComplete: Boolean(driverProfile.isProfileComplete),
  isApproved: Boolean(driverProfile.isApproved),
  driver: mapDriverProfile(driverProfile)
});

const getProfile = async (user) => {
  const driverProfile = await getDriverProfileOrFail(user.id);
  return buildProfileResponse(driverProfile);
};

const submitKyc = async (user, payload, files = {}) => {
  const normalizedPhone = assertValidIndianPhone(payload.phoneNumber);

  await sequelize.transaction(async (transaction) => {
    const driverProfile = await getDriverProfileOrFail(user.id, transaction);

    await userRepository.updateUser(
      user.id,
      {
        name: payload.fullName,
        phoneNumber: normalizedPhone.e164
      },
      transaction
    );

    await driverRepository.updateDriverProfile(driverProfile, {
      fullName: payload.fullName,
      vehicleType: payload.vehicleType,
      vehicleNumber: payload.vehicleNumber,
      licenseNumber: payload.licenseNumber,
      // licenseImageUrl: files.licenseImageUrl, // skip image
      // rcImageUrl: files.rcImageUrl, // skip image
      // profilePhotoUrl: files.profilePhotoUrl, // skip image
      isProfileComplete: true,
      isApproved: false,
      isOnline: false,
      kycStatus: KYC_STATUSES.PENDING
    }, transaction);
  });

  const updatedDriver = await driverRepository.findByUserId(user.id);
  realtimeGateway.syncDriverSession(updatedDriver.id, {
    kycStatus: updatedDriver.kycStatus,
    isOnline: updatedDriver.isOnline,
    isApproved: updatedDriver.isApproved,
    isProfileComplete: updatedDriver.isProfileComplete
  });
  await userRepository.invalidateAuthUserCache(user.id);

  return buildProfileResponse(updatedDriver);
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

const approveDriver = async (driverId) => {
  await sequelize.transaction(async (transaction) => {
    const driverProfile = await driverRepository.findById(driverId, transaction);

    if (!driverProfile) {
      throw new ApiError(404, 'Driver profile not found');
    }

    await driverRepository.updateDriverProfile(driverProfile, {
      isApproved: true,
      isProfileComplete: true,
      kycStatus: KYC_STATUSES.APPROVED
    }, transaction);
  });

  const updatedDriver = await driverRepository.findById(driverId);

  realtimeGateway.syncDriverSession(updatedDriver.id, {
    kycStatus: updatedDriver.kycStatus,
    isApproved: updatedDriver.isApproved,
    isProfileComplete: updatedDriver.isProfileComplete
  });
  await userRepository.invalidateAuthUserCache(updatedDriver.userId);

  return buildProfileResponse(updatedDriver);
};

module.exports = {
  getProfile,
  submitKyc,
  setOnlineStatus,
  getAvailableRides,
  acceptRide,
  startRide,
  endRide,
  approveDriver
};
