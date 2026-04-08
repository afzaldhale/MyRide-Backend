const http = require('http');
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');

const env = require('../config/env');
const logger = require('../config/logger');
const { getRedisPubSubClients } = require('../config/redis');
const userRepository = require('../repositories/user.repository');
const driverRepository = require('../repositories/driver.repository');
const locationStore = require('./locationStore.service');
const socketRegistry = require('./socketRegistry.service');
const realtimeGateway = require('./realtimeGateway.service');
const matchingService = require('./matching.service');
const driverService = require('./driver.service');
const cacheService = require('./cache.service');
const sessionService = require('./session.service');
const tokenService = require('./token.service');
const ApiError = require('../utils/apiError');
const { SOCKET_EVENTS, USER_ROLES, KYC_STATUSES } = require('../utils/constants');

const authenticateSocket = async (socket, next) => {
  try {
    const authHeader = socket.handshake.headers.authorization;
    const authToken = socket.handshake.auth?.token;
    const token = authToken || (authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null);

    if (!token) {
      throw new ApiError(401, 'Socket authentication token is required');
    }

    const decoded = tokenService.verifyAccessToken(token);

    if (await cacheService.isAccessTokenBlacklisted(decoded.jti)) {
      throw new ApiError(401, 'Authorization token has been invalidated');
    }

    await sessionService.getActiveSessionOrFail(decoded.sid, decoded.sub);

    const user = await userRepository.findAuthUserById(decoded.sub);

    if (!user) {
      throw new ApiError(401, 'Invalid socket authentication token');
    }

    socket.data.user = user;
    socket.data.auth = {
      tokenId: decoded.jti,
      sessionId: decoded.sid,
      expiresAt: decoded.exp
    };

    if (user.role === USER_ROLES.DRIVER) {
      const driverProfile = await driverRepository.findByUserId(user.id);
      if (driverProfile) {
        socket.data.driverProfile = driverProfile;
      }
    }

    return next();
  } catch (error) {
    return next(error);
  }
};

const assertValidCoordinates = (payload) => {
  const lat = Number(payload?.lat);
  const lng = Number(payload?.lng);

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    throw new ApiError(400, 'lat and lng must be valid numbers');
  }

  return { lat, lng };
};

const handleDriverLocationUpdate = async (socket, payload) => {
  const user = socket.data.user;
  const driverProfile = socket.data.driverProfile;

  if (!user || user.role !== USER_ROLES.DRIVER || !driverProfile) {
    throw new ApiError(403, 'Only authenticated drivers can update location');
  }

  if (!driverProfile.isOnline) {
    throw new ApiError(409, 'Driver must be online before updating location');
  }

  if (driverProfile.kycStatus !== KYC_STATUSES.APPROVED) {
    throw new ApiError(403, 'Only approved drivers can publish realtime location');
  }

  const lastUpdateAt = socket.data.lastLocationUpdateAt || 0;
  if (Date.now() - lastUpdateAt < env.matching.locationThrottleMs) {
    return;
  }

  const { lat, lng } = assertValidCoordinates(payload);
  const timestamp = Date.now();

  socket.data.lastLocationUpdateAt = timestamp;

  await locationStore.setDriverLocation(driverProfile.id, {
    lat,
    lng,
    timestamp
  });

  if (payload?.rideId) {
    realtimeGateway.emitToRide(payload.rideId, SOCKET_EVENTS.DRIVER_LOCATION_UPDATE, {
      rideId: payload.rideId,
      driverId: driverProfile.id,
      lat,
      lng,
      timestamp
    });
  }
};

const registerSocketLifecycle = (io, socket) => {
  const user = socket.data.user;
  socket.join(realtimeGateway.userRoom(user.id));

  if (socket.data.driverProfile) {
    const driverId = socket.data.driverProfile.id;
    socket.join(realtimeGateway.driverRoom(driverId));
    socketRegistry.registerDriverSocket(driverId, socket.id);
  }

  socket.on(SOCKET_EVENTS.DRIVER_LOCATION_UPDATE, async (payload = {}) => {
    try {
      await handleDriverLocationUpdate(socket, payload);
    } catch (error) {
      socket.emit('error', {
        message: error.message,
        code: error.statusCode || 500
      });
    }
  });

  socket.on(SOCKET_EVENTS.RIDE_ACCEPT, async (payload = {}) => {
    try {
      const ride = await driverService.acceptRide(user, payload.rideId);
      await matchingService.markRideAccepted(ride);
      socket.emit(SOCKET_EVENTS.RIDE_ACCEPT, {
        rideId: ride.id,
        status: ride.status
      });
    } catch (error) {
      socket.emit('error', {
        message: error.message,
        code: error.statusCode || 500
      });
    }
  });

  socket.on(SOCKET_EVENTS.RIDE_START, async (payload = {}) => {
    try {
      const ride = await driverService.startRide(user, payload.rideId, payload.ride_otp);
      socket.emit(SOCKET_EVENTS.RIDE_START, {
        rideId: ride.id,
        status: ride.status
      });
    } catch (error) {
      socket.emit('error', {
        message: error.message,
        code: error.statusCode || 500
      });
    }
  });

  socket.on(SOCKET_EVENTS.RIDE_END, async (payload = {}) => {
    try {
      const ride = await driverService.endRide(user, payload.rideId);
      socket.emit(SOCKET_EVENTS.RIDE_END, {
        rideId: ride.id,
        status: ride.status
      });
    } catch (error) {
      socket.emit('error', {
        message: error.message,
        code: error.statusCode || 500
      });
    }
  });

  socket.on('disconnect', async () => {
    const driverId = socket.data.driverProfile?.id;
    if (driverId) {
      socketRegistry.unregisterDriverSocket(driverId, socket.id);
      if (socketRegistry.getDriverSocketIds(driverId).length === 0) {
        try {
          await locationStore.removeDriverLocation(driverId);
        } catch (error) {
          logger.warn('Failed to clear driver location on disconnect', {
            driverId,
            error: error.message
          });
        }
      }
    }
  });
};

const createHttpServer = async (app) => {
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: env.socket.corsOrigin,
      credentials: true
    }
  });

  const redisClients = await getRedisPubSubClients();
  if (redisClients) {
    io.adapter(createAdapter(redisClients.pubClient, redisClients.subClient));
    logger.info('Socket.IO Redis adapter enabled');
  }

  io.use(authenticateSocket);
  io.on('connection', (socket) => registerSocketLifecycle(io, socket));

  realtimeGateway.setIo(io);
  realtimeGateway.emitGatewayHealth();

  return httpServer;
};

module.exports = {
  createHttpServer
};
