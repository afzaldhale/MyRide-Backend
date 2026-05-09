const sequelize = require('../db/sequelize');
const driverRepository = require('../repositories/driver.repository');
const rideRepository = require('../repositories/ride.repository');
const userRepository = require('../repositories/user.repository');
const ApiError = require('../utils/apiError');
const matchingService = require('./matching.service');
const realtimeGateway = require('./realtimeGateway.service');
const locationStore = require('./locationStore.service');
const { attachDriverLocation } = require('./rideTrackingPayload.service');
const { KYC_STATUSES, RIDE_STATUSES, SOCKET_EVENTS } = require('../utils/constants');
const { assertValidIndianPhone } = require('../utils/phone');

const DRIVER_STATUS_TRANSITIONS = {
  [RIDE_STATUSES.ACCEPTED]: [RIDE_STATUSES.DRIVER_ARRIVING, RIDE_STATUSES.ARRIVED],
  [RIDE_STATUSES.DRIVER_ARRIVING]: [RIDE_STATUSES.ARRIVED],
  [RIDE_STATUSES.ARRIVED]: [RIDE_STATUSES.IN_PROGRESS],
  [RIDE_STATUSES.IN_PROGRESS]: [RIDE_STATUSES.COMPLETED]
};

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

const getPendingRideRequests = async (user) => {
  const driverProfile = await getDriverProfileOrFail(user.id);
  return rideRepository.getDriverPendingRides(driverProfile.id);
};

const getActiveRide = async (user) => {
  const driverProfile = await getDriverProfileOrFail(user.id);
  const ride = await rideRepository.getActiveRideByDriverId(driverProfile.userId);
  return attachDriverLocation(ride);
};

const normalizeDriverLocationPayload = (payload = {}) => {
  const lat = Number(payload.driverLat);
  const lng = Number(payload.driverLng);
  const heading = Number(payload.driverHeading);
  const speed = Number(payload.driverSpeed);

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return null;
  }

  return {
    lat,
    lng,
    heading: Number.isNaN(heading) ? 0 : heading,
    speed: Number.isNaN(speed) ? 0 : speed,
    timestamp: Date.now()
  };
};

const emitDriverLocationUpdate = async (ride, driverProfile, location) => {
  const rideWithTracking = await attachDriverLocation(ride);
  const payload = {
    rideId: ride.id,
    driverId: driverProfile.id,
    lat: Number(location.lat),
    lng: Number(location.lng),
    heading: Number(location.heading || 0),
    speed: Number(location.speed || 0),
    timestamp: Number(location.timestamp),
    ride: rideWithTracking
  };

  realtimeGateway.emitToRide(ride.id, SOCKET_EVENTS.DRIVER_LOCATION_UPDATE, payload);
  realtimeGateway.emitToRide(ride.id, SOCKET_EVENTS.RIDE_DRIVER_LOCATION, payload);
  realtimeGateway.emitToRide(ride.id, SOCKET_EVENTS.RIDE_SYNC, {
    rideId: ride.id,
    status: rideWithTracking.status,
    driverId: rideWithTracking.driverId,
    driverLocation: rideWithTracking.driver_location || null,
    ride: rideWithTracking
  });
};

const acceptRide = async (user, rideId, payload = {}) =>
  sequelize.transaction(async (transaction) => {
    const driverProfile = await getDriverProfileOrFail(user.id, transaction);
    const ride = await rideRepository.findByIdForUpdate(rideId, transaction);

    if (!driverProfile.isOnline) {
      throw new ApiError(409, 'Driver must be online before accepting rides');
    }

    if (!ride) {
      throw new ApiError(404, 'Ride not found');
    }

    const activeRide = await rideRepository.getActiveRideByDriverId(driverProfile.userId);
    if (activeRide && activeRide.id !== rideId) {
      throw new ApiError(409, 'You already have an active ride in progress');
    }

    if (ride.status !== RIDE_STATUSES.REQUESTED || ride.driverId) {
      throw new ApiError(409, 'Ride is no longer available');
    }

    if ((ride.rejectedDriverIds || []).includes(driverProfile.id)) {
      throw new ApiError(409, 'You already rejected this ride request');
    }

    if (driverProfile.kycStatus !== KYC_STATUSES.APPROVED) {
      throw new ApiError(403, 'Only approved KYC drivers can accept rides');
    }

    await rideRepository.updateRide(
      ride,
      {
        driverId: driverProfile.userId,
        status: RIDE_STATUSES.ACCEPTED
      },
      transaction
    );

    return rideRepository.findById(rideId, transaction);
  }).then(async (ride) => {
    const initialLocation =
      normalizeDriverLocationPayload(payload) ||
      await locationStore.getDriverLocation((await getDriverProfileOrFail(user.id)).id);

    if (initialLocation) {
      const driverProfile = await getDriverProfileOrFail(user.id);
      await locationStore.setDriverLocation(driverProfile.id, {
        lat: Number(initialLocation.lat),
        lng: Number(initialLocation.lng),
        heading: Number(initialLocation.heading || 0),
        speed: Number(initialLocation.speed || 0),
        timestamp: Number(initialLocation.timestamp || Date.now())
      });
    }

    await matchingService.markRideAccepted(ride);
    return attachDriverLocation(ride);
  });

const rejectRide = async (user, rideId) =>
  sequelize.transaction(async (transaction) => {
    const driverProfile = await getDriverProfileOrFail(user.id, transaction);
    const ride = await rideRepository.findByIdForUpdate(rideId, transaction);

    if (!ride) {
      throw new ApiError(404, 'Ride not found');
    }

    if (ride.status !== RIDE_STATUSES.REQUESTED || ride.driverId) {
      throw new ApiError(409, 'Ride is no longer available');
    }

    const rejectedDriverIds = Array.from(new Set([...(ride.rejectedDriverIds || []), driverProfile.id]));

    await rideRepository.updateRide(
      ride,
      {
        rejectedDriverIds,
        status: RIDE_STATUSES.REQUESTED
      },
      transaction
    );

    return rideRepository.findById(rideId, transaction);
  }).then((ride) => {
    matchingService.clearMatchQueue(ride.id);
    matchingService.startMatching(ride).catch(() => null);
    return ride;
  });

const updateRideStatus = async (user, rideId, nextStatus) =>
  sequelize.transaction(async (transaction) => {
    const driverProfile = await getDriverProfileOrFail(user.id, transaction);
    const ride = await rideRepository.findByIdForUpdate(rideId, transaction);

    if (!ride || ride.driverId !== driverProfile.userId) {
      throw new ApiError(404, 'Assigned ride not found');
    }

    const allowedStatuses = DRIVER_STATUS_TRANSITIONS[ride.status] || [];
    if (!allowedStatuses.includes(nextStatus)) {
      throw new ApiError(409, `Ride cannot transition from ${ride.status} to ${nextStatus}`);
    }

    await rideRepository.updateRide(
      ride,
      {
        status: nextStatus
      },
      transaction
    );

    return rideRepository.findById(rideId, transaction);
  }).then(async (ride) => {
    await matchingService.emitRideStatusUpdate(SOCKET_EVENTS.RIDE_STATUS_UPDATE, ride);
    return attachDriverLocation(ride);
  });

const startRide = async (user, rideId, rideOtp) =>
  sequelize.transaction(async (transaction) => {
    const driverProfile = await getDriverProfileOrFail(user.id, transaction);
    const ride = await rideRepository.findByIdForUpdate(rideId, transaction);

    if (!ride || ride.driverId !== driverProfile.userId) {
      throw new ApiError(404, 'Assigned ride not found');
    }

    if (ride.status !== RIDE_STATUSES.ARRIVED) {
      throw new ApiError(409, `Ride cannot be started when status is ${ride.status}`);
    }

    if (ride.rideOtp !== rideOtp) {
      throw new ApiError(400, 'Invalid ride OTP');
    }

    await rideRepository.updateRide(
      ride,
      {
        status: RIDE_STATUSES.IN_PROGRESS
      },
      transaction
    );

    return rideRepository.findById(rideId, transaction);
  }).then(async (ride) => {
    await matchingService.emitRideStatusUpdate(SOCKET_EVENTS.RIDE_START, ride);
    return attachDriverLocation(ride);
  });

const endRide = async (user, rideId) =>
  sequelize.transaction(async (transaction) => {
    const driverProfile = await getDriverProfileOrFail(user.id, transaction);
    const ride = await rideRepository.findByIdForUpdate(rideId, transaction);

    if (!ride || ride.driverId !== driverProfile.userId) {
      throw new ApiError(404, 'Assigned ride not found');
    }

    if (ride.status !== RIDE_STATUSES.IN_PROGRESS) {
      throw new ApiError(409, `Ride cannot be completed when status is ${ride.status}`);
    }

    await rideRepository.updateRide(
      ride,
      {
        status: RIDE_STATUSES.COMPLETED
      },
      transaction
    );

    return rideRepository.findById(rideId, transaction);
  }).then(async (ride) => {
    await matchingService.emitRideStatusUpdate(SOCKET_EVENTS.RIDE_END, ride);
    return attachDriverLocation(ride);
  });

const updateDriverLocation = async (user, rideId, payload = {}) => {
  const driverProfile = await getDriverProfileOrFail(user.id);
  const ride = await rideRepository.findById(rideId);

  if (!ride || ride.driverId !== driverProfile.userId) {
    throw new ApiError(404, 'Assigned ride not found');
  }

  if (
    ![
      RIDE_STATUSES.ACCEPTED,
      RIDE_STATUSES.DRIVER_ARRIVING,
      RIDE_STATUSES.ARRIVED,
      RIDE_STATUSES.IN_PROGRESS
    ].includes(ride.status)
  ) {
    throw new ApiError(409, `Driver location cannot be updated when ride status is ${ride.status}`);
  }

  const location = normalizeDriverLocationPayload(payload);
  if (!location) {
    throw new ApiError(400, 'driverLat and driverLng are required');
  }

  await locationStore.setDriverLocation(driverProfile.id, location);
  await emitDriverLocationUpdate(ride, driverProfile, location);

  return attachDriverLocation(ride);
};

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
  getPendingRideRequests,
  getActiveRide,
  acceptRide,
  updateDriverLocation,
  rejectRide,
  updateRideStatus,
  startRide,
  endRide,
  approveDriver
};
