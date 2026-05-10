const { RIDE_STATUSES } = require('../utils/constants');

const STALE_RIDE_WINDOWS_MS = {
  [RIDE_STATUSES.REQUESTED]: 5 * 60 * 1000,
  [RIDE_STATUSES.ACCEPTED]: 15 * 60 * 1000,
  [RIDE_STATUSES.DRIVER_ARRIVING]: 15 * 60 * 1000,
  [RIDE_STATUSES.ARRIVED]: 10 * 60 * 1000,
};

const isPreTripStatus = (status) =>
  [
    RIDE_STATUSES.REQUESTED,
    RIDE_STATUSES.ACCEPTED,
    RIDE_STATUSES.DRIVER_ARRIVING,
    RIDE_STATUSES.ARRIVED,
  ].includes(status);

const shouldAutoCloseStaleRide = (ride) => {
  if (!ride || !isPreTripStatus(ride.status)) {
    return false;
  }

  const updatedAt = ride.updatedAt instanceof Date
    ? ride.updatedAt
    : new Date(ride.updatedAt || ride.createdAt || Date.now());
  const staleWindowMs = STALE_RIDE_WINDOWS_MS[ride.status];
  if (!staleWindowMs || Number.isNaN(updatedAt.getTime())) {
    return false;
  }

  return Date.now() - updatedAt.getTime() >= staleWindowMs;
};

module.exports = {
  isPreTripStatus,
  shouldAutoCloseStaleRide,
};
