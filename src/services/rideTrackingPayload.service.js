const driverRepository = require('../repositories/driver.repository');
const locationStore = require('./locationStore.service');

const toPlainRide = (ride) => {
  if (!ride) {
    return ride;
  }

  return typeof ride.toJSON === 'function' ? ride.toJSON() : { ...ride };
};

const resolveDriverProfileId = async (ride) => {
  if (!ride) {
    return null;
  }

  if (ride.driver?.id) {
    return ride.driver.id;
  }

  if (!ride.driverId) {
    return null;
  }

  const driverProfile = await driverRepository.findByUserId(ride.driverId);
  return driverProfile?.id ?? null;
};

const attachDriverLocation = async (ride) => {
  if (!ride) {
    return ride;
  }

  const plainRide = toPlainRide(ride);
  const driverProfileId = await resolveDriverProfileId(plainRide);
  if (!driverProfileId) {
    return plainRide;
  }

  const location = await locationStore.getDriverLocation(driverProfileId);
  if (!location) {
    return plainRide;
  }

  return {
    ...plainRide,
    driver_lat: Number(location.lat),
    driver_lng: Number(location.lng),
    driver_heading: Number(location.heading || 0),
    driver_speed: Number(location.speed || 0),
    driver_location_updated_at: Number(location.timestamp),
    driver_location: {
      lat: Number(location.lat),
      lng: Number(location.lng),
      heading: Number(location.heading || 0),
      speed: Number(location.speed || 0),
      timestamp: Number(location.timestamp),
    },
  };
};

const sanitizeRidePayload = (ride, audience = 'shared') => {
  if (!ride) {
    return ride;
  }

  const plainRide = toPlainRide(ride);
  const sanitizedRide = {
    ...plainRide,
  };

  if (audience !== 'rider') {
    delete sanitizedRide.rideOtp;
    delete sanitizedRide.ride_otp;
  }

  return sanitizedRide;
};

module.exports = {
  attachDriverLocation,
  sanitizeRidePayload,
};
