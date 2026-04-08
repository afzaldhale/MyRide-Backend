const logger = require('../config/logger');
const socketRegistry = require('./socketRegistry.service');

let ioInstance = null;

const userRoom = (userId) => `user_${userId}`;
const driverRoom = (driverId) => `driver_${driverId}`;
const rideRoom = (rideId) => `ride_${rideId}`;

const setIo = (io) => {
  ioInstance = io;
};

const getIo = () => {
  if (!ioInstance) {
    throw new Error('Socket.IO has not been initialized');
  }

  return ioInstance;
};

const emitToUser = (userId, event, payload) => {
  if (!ioInstance) {
    return;
  }

  ioInstance.to(userRoom(userId)).emit(event, payload);
};

const emitToDriver = (driverId, event, payload) => {
  if (!ioInstance) {
    return;
  }

  ioInstance.to(driverRoom(driverId)).emit(event, payload);
};

const emitToRide = (rideId, event, payload) => {
  if (!ioInstance) {
    return;
  }

  ioInstance.to(rideRoom(rideId)).emit(event, payload);
};

const attachRideParticipants = async ({ rideId, riderId, driverId }) => {
  if (!ioInstance) {
    return;
  }

  const room = rideRoom(rideId);
  await ioInstance.in(userRoom(riderId)).socketsJoin(room);
  await ioInstance.in(driverRoom(driverId)).socketsJoin(room);
};

const syncDriverSession = (driverId, patch) => {
  if (!ioInstance) {
    return;
  }

  for (const socketId of socketRegistry.getDriverSocketIds(driverId)) {
    const socket = ioInstance.sockets.sockets.get(socketId);
    if (socket) {
      socket.data.driverProfile = {
        ...(socket.data.driverProfile || {}),
        ...patch
      };
    }
  }
};

const emitGatewayHealth = () => {
  if (!ioInstance) {
    return;
  }

  logger.info('Realtime gateway ready', {
    namespace: '/'
  });
};

module.exports = {
  setIo,
  getIo,
  userRoom,
  driverRoom,
  rideRoom,
  emitToUser,
  emitToDriver,
  emitToRide,
  attachRideParticipants,
  syncDriverSession,
  emitGatewayHealth
};
