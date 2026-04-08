module.exports = {
  USER_ROLES: {
    RIDER: 'rider',
    DRIVER: 'driver'
  },
  TOKEN_TYPES: {
    ACCESS: 'access',
    REFRESH: 'refresh'
  },
  CACHE_KEYS: {
    SESSION: 'session',
    AUTH_USER: 'auth_user',
    ACCESS_BLACKLIST: 'access_blacklist',
    RATE_LIMIT: 'rate_limit'
  },
  SESSION_SECURITY_EVENTS: {
    REFRESH_REUSE_DETECTED: 'refresh_reuse_detected',
    SESSION_LIMIT_ENFORCED: 'session_limit_enforced'
  },
  KYC_STATUSES: {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected'
  },
  RIDE_STATUSES: {
    REQUESTED: 'requested',
    ACCEPTED: 'accepted',
    STARTED: 'started',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
  },
  SUBSCRIPTION_STATUSES: {
    ACTIVE: 'active',
    EXPIRED: 'expired',
    CANCELLED: 'cancelled'
  },
  OTP_ATTEMPT_TYPES: {
    SEND: 'send',
    VERIFY: 'verify'
  },
  OTP_LIMITS: {
    PHONE_SEND_MAX: 3,
    PHONE_SEND_WINDOW_MINUTES: 10,
    IP_SEND_MAX: 10,
    IP_SEND_WINDOW_MINUTES: 60,
    DEVICE_SEND_MAX: 5,
    DEVICE_SEND_WINDOW_MINUTES: 30,
    SESSION_TTL_MINUTES: 5,
    MAX_VERIFY_ATTEMPTS: 3
  },
  SOCKET_EVENTS: {
    DRIVER_LOCATION_UPDATE: 'driver:location:update',
    RIDE_REQUEST: 'ride:request',
    RIDE_ACCEPT: 'ride:accept',
    RIDE_START: 'ride:start',
    RIDE_END: 'ride:end',
    RIDE_SEARCHING: 'ride:searching',
    RIDE_MATCHING_FAILED: 'ride:matching:failed',
    RIDE_STATUS_UPDATE: 'ride:status:update'
  }
};
