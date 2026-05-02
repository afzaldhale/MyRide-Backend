const env = require('../config/env');
const driverRepository = require('../repositories/driver.repository');
const locationStore = require('./locationStore.service');
const { getDistanceInKm } = require('../utils/distance');
const { SOCKET_EVENTS } = require('../utils/constants');

const nearbySubscriptions = new Map();

const DEFAULT_RADIUS_KM = env.matching.searchRadiusKm;
const MAX_RADIUS_KM = 10;
const MAX_NEARBY_DRIVERS = 25;

const normalizeCoordinate = (value, field) => {
  const coordinate = Number(value);

  if (Number.isNaN(coordinate)) {
    const error = new Error(`${field} must be a valid number`);
    error.statusCode = 400;
    throw error;
  }

  return coordinate;
};

const normalizeRadius = (value) => {
  if (value === undefined || value === null) {
    return DEFAULT_RADIUS_KM;
  }

  const radiusKm = Number(value);

  if (Number.isNaN(radiusKm) || radiusKm <= 0) {
    const error = new Error('radiusKm must be a positive number');
    error.statusCode = 400;
    throw error;
  }

  return Math.min(radiusKm, MAX_RADIUS_KM);
};

const buildDriverPayload = ({ driver, location, distanceKm }) => ({
  driverId: driver.id,
  userId: driver.userId,
  lat: Number(location.lat),
  lng: Number(location.lng),
  heading: Number(location.heading || 0),
  speed: Number(location.speed || 0),
  timestamp: Number(location.timestamp),
  distanceKm: distanceKm === undefined ? undefined : Number(distanceKm.toFixed(2)),
  name: driver.user?.name || null,
  vehicleType: driver.vehicleType || null,
  vehicleNumber: driver.vehicleNumber || null
});

const setNearbySubscription = (socket, payload = {}) => {
  const lat = normalizeCoordinate(payload.lat, 'lat');
  const lng = normalizeCoordinate(payload.lng, 'lng');
  const radiusKm = normalizeRadius(payload.radiusKm);

  nearbySubscriptions.set(socket.id, {
    socketId: socket.id,
    userId: socket.data.user.id,
    lat,
    lng,
    radiusKm,
    updatedAt: Date.now()
  });

  return nearbySubscriptions.get(socket.id);
};

const removeNearbySubscription = (socketId) => {
  nearbySubscriptions.delete(socketId);
};

const listNearbyDrivers = async ({ lat, lng, radiusKm = DEFAULT_RADIUS_KM }) => {
  const activeDrivers = await driverRepository.findActiveApprovedDrivers();
  const activeDriversById = new Map(activeDrivers.map((driver) => [driver.id, driver]));
  const nearbyLocations = locationStore.getNearbyDriverLocations({
    lat,
    lng,
    radiusKm,
    distanceCalculator: getDistanceInKm
  });

  return nearbyLocations
    .map((candidate) => {
      const driver = activeDriversById.get(candidate.driverId);
      if (!driver) {
        return null;
      }

      return buildDriverPayload({
        driver,
        location: candidate.location,
        distanceKm: candidate.distanceKm
      });
    })
    .filter(Boolean)
    .slice(0, MAX_NEARBY_DRIVERS);
};

const emitNearbyDriversSnapshot = async (socket) => {
  const subscription = nearbySubscriptions.get(socket.id);
  if (!subscription) {
    return;
  }

  const drivers = await listNearbyDrivers(subscription);

  socket.emit(SOCKET_EVENTS.DRIVERS_NEARBY_UPDATE, {
    type: 'snapshot',
    center: {
      lat: subscription.lat,
      lng: subscription.lng
    },
    radiusKm: subscription.radiusKm,
    drivers,
    removedDriverIds: [],
    timestamp: Date.now()
  });
};

const emitDriverLocationToSubscribers = (io, driver, location) => {
  if (!io) {
    return;
  }

  for (const subscription of nearbySubscriptions.values()) {
    const distanceKm = getDistanceInKm(
      Number(location.lat),
      Number(location.lng),
      subscription.lat,
      subscription.lng
    );

    if (distanceKm <= subscription.radiusKm) {
      io.to(subscription.socketId).emit(SOCKET_EVENTS.DRIVERS_NEARBY_UPDATE, {
        type: 'delta',
        center: {
          lat: subscription.lat,
          lng: subscription.lng
        },
        radiusKm: subscription.radiusKm,
        drivers: [
          buildDriverPayload({
            driver,
            location,
            distanceKm
          })
        ],
        removedDriverIds: [],
        timestamp: Date.now()
      });
      continue;
    }

    io.to(subscription.socketId).emit(SOCKET_EVENTS.DRIVERS_NEARBY_UPDATE, {
      type: 'delta',
      center: {
        lat: subscription.lat,
        lng: subscription.lng
      },
      radiusKm: subscription.radiusKm,
      drivers: [],
      removedDriverIds: [driver.id],
      timestamp: Date.now()
    });
  }
};

const emitDriverOfflineToSubscribers = (io, driverId) => {
  if (!io) {
    return;
  }

  for (const subscription of nearbySubscriptions.values()) {
    io.to(subscription.socketId).emit(SOCKET_EVENTS.DRIVERS_NEARBY_UPDATE, {
      type: 'delta',
      center: {
        lat: subscription.lat,
        lng: subscription.lng
      },
      radiusKm: subscription.radiusKm,
      drivers: [],
      removedDriverIds: [driverId],
      timestamp: Date.now()
    });
  }
};

module.exports = {
  setNearbySubscription,
  removeNearbySubscription,
  emitNearbyDriversSnapshot,
  emitDriverLocationToSubscribers,
  emitDriverOfflineToSubscribers
};
