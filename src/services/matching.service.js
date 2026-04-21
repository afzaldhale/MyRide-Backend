const env = require('../config/env');
const logger = require('../config/logger');
const driverRepository = require('../repositories/driver.repository');
const rideRepository = require('../repositories/ride.repository');
const locationStore = require('./locationStore.service');
const realtimeGateway = require('./realtimeGateway.service');
const ApiError = require('../utils/apiError');
const { getDistanceInKm } = require('../utils/distance');
const { RIDE_STATUSES, SOCKET_EVENTS } = require('../utils/constants');

const activeMatchQueues = new Map();

const buildRideRequestPayload = (ride, distanceKm) => ({
  rideId: ride.id,
  pickup: {
    lat: Number(ride.pickupLat),
    lng: Number(ride.pickupLng)
  },
  drop: {
    lat: Number(ride.dropLat),
    lng: Number(ride.dropLng)
  },
  rider: ride.rider
    ? {
        id: ride.rider.id,
        name: ride.rider.name,
        phone_number: ride.rider.phoneNumber
      }
    : null,
  distance_km: Number(distanceKm.toFixed(2)),
  requested_at: ride.createdAt
});

const clearQueueTimer = (queue) => {
  if (queue?.timeout) {
    clearTimeout(queue.timeout);
    queue.timeout = null;
  }
};

const clearMatchQueue = (rideId) => {
  const queue = activeMatchQueues.get(rideId);
  if (!queue) {
    return;
  }

  clearQueueTimer(queue);
  activeMatchQueues.delete(rideId);
};

const findNearestDrivers = async ({ pickupLat, pickupLng, limit, radiusKm }) => {
  const drivers = await driverRepository.findActiveApprovedDrivers();
  const locations = await locationStore.getDriverLocations(drivers.map((driver) => driver.id));

  return drivers
    .map((driver) => {
      const location = locations.get(driver.id);
      if (!location) {
        return null;
      }

      const distanceKm = getDistanceInKm(
        Number(location.lat),
        Number(location.lng),
        Number(pickupLat),
        Number(pickupLng)
      );

      return {
        driver,
        location,
        distanceKm
      };
    })
    .filter((candidate) => candidate && candidate.distanceKm <= radiusKm)
    .sort((left, right) => left.distanceKm - right.distanceKm)
    .slice(0, limit);
};

const dispatchBatch = async (rideId) => {
  const queue = activeMatchQueues.get(rideId);
  if (!queue || queue.accepted) {
    return;
  }

  const ride = await rideRepository.findById(rideId);
  if (!ride || ride.status !== RIDE_STATUSES.REQUESTED || ride.driverId) {
    clearMatchQueue(rideId);
    return;
  }

  const batch = queue.candidates.slice(queue.cursor, queue.cursor + env.matching.maxInitialDrivers);

  if (batch.length === 0) {
    realtimeGateway.emitToUser(ride.riderId, SOCKET_EVENTS.RIDE_MATCHING_FAILED, {
      rideId,
      message: 'No nearby drivers accepted this ride request.'
    });
    clearMatchQueue(rideId);
    return;
  }

  queue.cursor += batch.length;
  queue.activeDriverIds = batch.map((candidate) => candidate.driver.id);

  for (const candidate of batch) {
    realtimeGateway.emitToDriver(
      candidate.driver.id,
      SOCKET_EVENTS.RIDE_REQUEST,
      buildRideRequestPayload(ride, candidate.distanceKm)
    );
  }

  clearQueueTimer(queue);
  queue.timeout = setTimeout(() => {
    dispatchBatch(rideId).catch((error) => {
      logger.error('Ride dispatch retry failed', {
        rideId,
        error: error.message
      });
    });
  }, env.matching.driverResponseTimeoutMs);
};

const startMatching = async (ride) => {
  try {
    const hydratedRide = await rideRepository.findById(ride.id);
    
    logger.info('Starting driver matching process', {
      rideId: hydratedRide.id,
      pickupLat: hydratedRide.pickupLat,
      pickupLng: hydratedRide.pickupLng,
      vehicleType: hydratedRide.vehicleType
    });

    const candidates = await findNearestDrivers({
      pickupLat: hydratedRide.pickupLat,
      pickupLng: hydratedRide.pickupLng,
      limit: 15,
      radiusKm: env.matching.searchRadiusKm
    });

    logger.info('Driver search completed', {
      rideId: hydratedRide.id,
      candidateCount: candidates.length,
      radiusKm: env.matching.searchRadiusKm
    });

    // Safe emit - check if realtimeGateway is initialized
    try {
      realtimeGateway.emitToUser(hydratedRide.riderId, SOCKET_EVENTS.RIDE_SEARCHING, {
        rideId: hydratedRide.id,
        candidate_count: candidates.length,
        radius_km: env.matching.searchRadiusKm
      });
    } catch (socketError) {
      logger.warn('Failed to emit RIDE_SEARCHING event (Socket.IO not ready)', {
        rideId: hydratedRide.id,
        error: socketError.message
      });
    }

    if (candidates.length === 0) {
      logger.warn('No drivers found for ride', {
        rideId: hydratedRide.id,
        pickupLat: hydratedRide.pickupLat,
        pickupLng: hydratedRide.pickupLng
      });
      
      try {
        realtimeGateway.emitToUser(hydratedRide.riderId, SOCKET_EVENTS.RIDE_MATCHING_FAILED, {
          rideId: hydratedRide.id,
          message: 'No approved online drivers were found nearby.'
        });
      } catch (socketError) {
        logger.warn('Failed to emit RIDE_MATCHING_FAILED event', {
          rideId: hydratedRide.id,
          error: socketError.message
        });
      }

      return {
        matchedDrivers: 0,
        status: 'no_drivers_found'
      };
    }

    logger.info('Setting up matching queue', {
      rideId: hydratedRide.id,
      candidateCount: candidates.length
    });

    activeMatchQueues.set(hydratedRide.id, {
      rideId: hydratedRide.id,
      riderId: hydratedRide.riderId,
      accepted: false,
      cursor: 0,
      candidates,
      activeDriverIds: [],
      timeout: null
    });

    await dispatchBatch(hydratedRide.id);

    logger.info('Matching dispatch initiated', {
      rideId: hydratedRide.id,
      dispatchedDrivers: Math.min(candidates.length, env.matching.maxInitialDrivers)
    });

    return {
      matchedDrivers: candidates.length,
      dispatchedDrivers: Math.min(candidates.length, env.matching.maxInitialDrivers),
      status: 'searching'
    };
  } catch (error) {
    logger.error('Matching process failed', {
      rideId: ride.id,
      error: error.message,
      stack: error.stack
    });
    
    // Return safe response instead of throwing - prevents 502
    return {
      matchedDrivers: 0,
      status: 'matching_failed',
      error: error.message
    };
  }
};

const ensureDriverCanAccept = (queue, driverId) => {
  if (!queue) {
    throw new ApiError(409, 'Ride is no longer accepting driver responses');
  }

  if (!queue.activeDriverIds.includes(driverId)) {
    throw new ApiError(403, 'Driver is not part of the active matching batch');
  }
};

const markRideAccepted = async (ride) => {
  const hydratedRide = ride.driver && ride.rider ? ride : await rideRepository.findById(ride.id);
  const queue = activeMatchQueues.get(hydratedRide.id);

  if (queue) {
    queue.accepted = true;
  }
  clearMatchQueue(hydratedRide.id);

  await realtimeGateway.attachRideParticipants({
    rideId: hydratedRide.id,
    riderId: hydratedRide.riderId,
    driverId: hydratedRide.driverId
  });

  realtimeGateway.emitToRide(hydratedRide.id, SOCKET_EVENTS.RIDE_ACCEPT, {
    rideId: hydratedRide.id,
    status: hydratedRide.status,
    driver: hydratedRide.driver,
    rider: hydratedRide.rider
  });

  realtimeGateway.emitToUser(hydratedRide.riderId, SOCKET_EVENTS.RIDE_ACCEPT, {
    rideId: hydratedRide.id,
    status: hydratedRide.status,
    driver: hydratedRide.driver
  });
};

const emitRideStatusUpdate = (eventName, ride) => {
  realtimeGateway.emitToRide(ride.id, eventName, {
    rideId: ride.id,
    status: ride.status,
    driverId: ride.driverId
  });

  realtimeGateway.emitToUser(ride.riderId, SOCKET_EVENTS.RIDE_STATUS_UPDATE, {
    rideId: ride.id,
    status: ride.status,
    event: eventName,
    driverId: ride.driverId
  });
};

const cancelMatching = (ride) => {
  clearMatchQueue(ride.id);
  realtimeGateway.emitToRide(ride.id, SOCKET_EVENTS.RIDE_STATUS_UPDATE, {
    rideId: ride.id,
    status: ride.status,
    event: 'ride:cancel'
  });
};

module.exports = {
  startMatching,
  findNearestDrivers,
  ensureDriverCanAccept,
  markRideAccepted,
  emitRideStatusUpdate,
  cancelMatching,
  clearMatchQueue
};
