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
  removeDriverLocation,
  getDriverLocationsSnapshot
};
