const rideRepository = require('../repositories/ride.repository');
const { attachDriverLocation, sanitizeRidePayload } = require('./rideTrackingPayload.service');
const realtimeGateway = require('./realtimeGateway.service');
const ApiError = require('../utils/apiError');
const { RIDE_STATUSES, SOCKET_EVENTS, USER_ROLES } = require('../utils/constants');

const TRACKING_STATUSES = {
  [RIDE_STATUSES.REQUESTED]: 'requested',
  [RIDE_STATUSES.ACCEPTED]: 'accepted',
  [RIDE_STATUSES.DRIVER_ARRIVING]: 'arriving',
  [RIDE_STATUSES.ARRIVED]: 'arrived',
  [RIDE_STATUSES.IN_PROGRESS]: 'started',
  [RIDE_STATUSES.COMPLETED]: 'completed',
  [RIDE_STATUSES.CANCELLED]: 'cancelled',
  [RIDE_STATUSES.REJECTED]: 'cancelled'
};

const resolveRideId = (payload = {}) => {
  const rideId = `${payload.rideId || payload.id || ''}`.trim();
  if (!rideId) {
    throw new ApiError(400, 'rideId is required');
  }

  return rideId;
};

const isRideParticipant = (user, ride) => {
  if (!user || !ride) {
    return false;
  }

  if (user.role === USER_ROLES.RIDER) {
    return ride.riderId === user.id;
  }

  if (user.role === USER_ROLES.DRIVER) {
    return ride.driverId === user.id;
  }

  return false;
};

const buildRideSyncPayload = async (rideOrId, audience = 'shared') => {
  const ride = typeof rideOrId === 'string'
    ? await rideRepository.findById(rideOrId)
    : rideOrId;

  if (!ride) {
    return null;
  }

  const rideWithTracking = sanitizeRidePayload(
    await attachDriverLocation(ride),
    audience,
  );

  return {
    rideId: rideWithTracking.id,
    room: realtimeGateway.rideRoom(rideWithTracking.id),
    status: rideWithTracking.status,
    trackingStatus: TRACKING_STATUSES[rideWithTracking.status] || rideWithTracking.status,
    driverId: rideWithTracking.driverId || rideWithTracking.driver?.id || null,
    riderId: rideWithTracking.riderId || rideWithTracking.rider?.id || null,
    driverLocation: rideWithTracking.driver_location || null,
    ride: rideWithTracking
  };
};

const joinRideRoom = async (socket, payload = {}) => {
  const rideId = resolveRideId(payload);
  const ride = await rideRepository.findById(rideId);

  if (!ride) {
    throw new ApiError(404, 'Ride not found');
  }

  if (!isRideParticipant(socket.data.user, ride)) {
    throw new ApiError(403, 'You are not allowed to join this ride room');
  }

  const room = realtimeGateway.rideRoom(rideId);
  await socket.join(room);

  const audience = socket.data.user?.role === USER_ROLES.RIDER ? 'rider' : 'driver';
  const syncPayload = await buildRideSyncPayload(ride, audience);
  socket.emit(SOCKET_EVENTS.RIDE_JOINED, syncPayload);
  socket.emit(SOCKET_EVENTS.RIDE_SYNC, syncPayload);

  return syncPayload;
};

const emitRideSync = async (rideOrId, socket) => {
  const audience = socket?.data?.user?.role === USER_ROLES.RIDER ? 'rider' : 'driver';
  const syncPayload = await buildRideSyncPayload(rideOrId, audience);
  if (!syncPayload) {
    return null;
  }

  socket.emit(SOCKET_EVENTS.RIDE_SYNC, syncPayload);
  return syncPayload;
};

module.exports = {
  buildRideSyncPayload,
  joinRideRoom,
  emitRideSync
};
