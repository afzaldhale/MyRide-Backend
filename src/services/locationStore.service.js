const { getRedisCommandClient } = require('../config/redis');
const logger = require('../config/logger');

const driverLocations = new Map();

const buildRedisKey = (driverId) => `driver:${driverId}`;

const persistToRedis = async (driverId, location) => {
  const redis = await getRedisCommandClient();
  if (!redis) {
    return;
  }

  await redis.hset(buildRedisKey(driverId), {
    lat: String(location.lat),
    lng: String(location.lng),
    heading: String(location.heading ?? 0),
    speed: String(location.speed ?? 0),
    timestamp: String(location.timestamp)
  });
};

const hydrateFromRedis = async (driverId) => {
  const redis = await getRedisCommandClient();
  if (!redis) {
    return null;
  }

  const data = await redis.hgetall(buildRedisKey(driverId));
  if (!data || !data.lat || !data.lng || !data.timestamp) {
    return null;
  }

  const location = {
    lat: Number(data.lat),
    lng: Number(data.lng),
    heading: Number(data.heading || 0),
    speed: Number(data.speed || 0),
    timestamp: Number(data.timestamp)
  };

  driverLocations.set(driverId, location);
  return location;
};

const setDriverLocation = async (driverId, location) => {
  driverLocations.set(driverId, location);

  try {
    await persistToRedis(driverId, location);
  } catch (error) {
    logger.warn('Failed to persist driver location to Redis', {
      driverId,
      error: error.message
    });
  }

  return location;
};

const getDriverLocation = async (driverId) => {
  if (driverLocations.has(driverId)) {
    return driverLocations.get(driverId);
  }

  return hydrateFromRedis(driverId);
};

const getDriverLocations = async (driverIds) => {
  const results = await Promise.all(
    driverIds.map(async (driverId) => [driverId, await getDriverLocation(driverId)])
  );

  return new Map(results.filter(([, location]) => Boolean(location)));
};

const getNearbyDriverLocations = ({ lat, lng, radiusKm, distanceCalculator }) => {
  const latitude = Number(lat);
  const longitude = Number(lng);
  const radius = Number(radiusKm);

  if (
    Number.isNaN(latitude) ||
    Number.isNaN(longitude) ||
    Number.isNaN(radius) ||
    typeof distanceCalculator !== 'function'
  ) {
    return [];
  }

  return Array.from(driverLocations.entries())
    .map(([driverId, location]) => {
      const distanceKm = distanceCalculator(
        Number(location.lat),
        Number(location.lng),
        latitude,
        longitude
      );

      return {
        driverId,
        location,
        distanceKm
      };
    })
    .filter((candidate) => candidate.distanceKm <= radius)
    .sort((left, right) => left.distanceKm - right.distanceKm);
};

const removeDriverLocation = async (driverId) => {
  driverLocations.delete(driverId);

  const redis = await getRedisCommandClient();
  if (!redis) {
    return;
  }

  await redis.del(buildRedisKey(driverId));
};

const getDriverLocationsSnapshot = () => new Map(driverLocations);

module.exports = {
  driverLocations,
  setDriverLocation,
  getDriverLocation,
  getDriverLocations,
  getNearbyDriverLocations,
  removeDriverLocation,
  getDriverLocationsSnapshot
};
