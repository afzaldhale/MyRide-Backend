const path = require('path');
const dotenv = require('dotenv');
const Joi = require('joi');

dotenv.config({
  path: path.resolve(process.cwd(), '.env')
});

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(5000),
  APP_NAME: Joi.string().trim().default('ride-platform-backend'),
  APP_VERSION: Joi.string().trim().default('1.0.0'),
  TRUST_PROXY: Joi.alternatives().try(Joi.boolean(), Joi.number().integer().min(0), Joi.string()).default(false),
  CORS_ORIGINS: Joi.string().allow('').default(''),
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'http', 'debug').default('info'),
  SHUTDOWN_TIMEOUT_MS: Joi.number().integer().min(1000).default(10000),
  API_RATE_LIMIT_WINDOW_MS: Joi.number().integer().min(1000).default(60000),
  API_RATE_LIMIT_MAX_REQUESTS: Joi.number().integer().min(1).default(120),
  DB_HOST: Joi.string().hostname().required(),
  DB_PORT: Joi.number().port().default(3306),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().allow('').required(),
  DB_NAME: Joi.string().required(),
  DB_SYNC: Joi.boolean().truthy('true').falsy('false').default(false),
  DB_POOL_MAX: Joi.number().integer().min(1).default(20),
  DB_POOL_MIN: Joi.number().integer().min(0).default(2),
  DB_POOL_ACQUIRE_MS: Joi.number().integer().min(1000).default(30000),
  DB_POOL_IDLE_MS: Joi.number().integer().min(1000).default(10000),
  JWT_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  REFRESH_TOKEN_SECRET: Joi.string().min(16).required(),
  REFRESH_TOKEN_EXPIRES_IN: Joi.string().default('30d'),
  REFRESH_TOKEN_TTL_DAYS: Joi.number().integer().min(1).default(30),
  MAX_ACTIVE_SESSIONS_PER_USER: Joi.number().integer().min(1).default(5),
  SESSION_CACHE_TTL_SECONDS: Joi.number().integer().min(30).default(300),
  USER_CACHE_TTL_SECONDS: Joi.number().integer().min(30).default(300),
  REDIS_FAILURE_COOLDOWN_MS: Joi.number().integer().min(1000).default(10000),
  SESSION_CLEANUP_CRON: Joi.string().default('*/15 * * * *'),
  SESSION_CLEANUP_BATCH_SIZE: Joi.number().integer().min(10).default(500),
  SESSION_RETENTION_DAYS: Joi.number().integer().min(1).default(30),
  FIREBASE_PROJECT_ID: Joi.string().required(),
  FIREBASE_CLIENT_EMAIL: Joi.string().allow('').optional(),
  FIREBASE_PRIVATE_KEY: Joi.string().allow('').optional(),
  SOCKET_CORS_ORIGIN: Joi.string().allow('').default('*'),
  REDIS_URL: Joi.string().uri({ scheme: ['redis', 'rediss'] }).allow('', null).default(null),
  REDIS_KEY_PREFIX: Joi.string().default('ride_app:'),
  MATCHING_RADIUS_KM: Joi.number().positive().default(5),
  MATCHING_MAX_INITIAL_DRIVERS: Joi.number().integer().min(1).default(3),
  MATCHING_DRIVER_RESPONSE_TIMEOUT_MS: Joi.number().integer().min(1000).default(12000),
  DRIVER_LOCATION_THROTTLE_MS: Joi.number().integer().min(500).default(2500),
  ADMIN_EMAIL: Joi.string().email().default('admin@rideops.com'),
  ADMIN_PASSWORD: Joi.string().min(6).default('Admin@123'),
  ADMIN_NAME: Joi.string().trim().default('Operations Lead'),
  ADMIN_TOKEN_EXPIRES_IN: Joi.string().default('8h')
})
  .unknown(true)
  .required();

const { value, error } = envSchema.validate(process.env, {
  abortEarly: false,
  convert: true
});

if (error) {
  throw new Error(`Environment validation failed: ${error.message}`);
}

const parseCorsOrigins = (origins) =>
  origins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

module.exports = {
  nodeEnv: value.NODE_ENV,
  app: {
    name: value.APP_NAME,
    version: value.APP_VERSION,
    trustProxy: value.TRUST_PROXY,
    shutdownTimeoutMs: value.SHUTDOWN_TIMEOUT_MS
  },
  port: value.PORT,
  cors: {
    origins: parseCorsOrigins(value.CORS_ORIGINS),
    allowAll: !value.CORS_ORIGINS || value.CORS_ORIGINS.trim().length === 0
  },
  rateLimit: {
    windowMs: value.API_RATE_LIMIT_WINDOW_MS,
    maxRequests: value.API_RATE_LIMIT_MAX_REQUESTS
  },
  logLevel: value.LOG_LEVEL,
  cache: {
    sessionTtlSeconds: value.SESSION_CACHE_TTL_SECONDS,
    userTtlSeconds: value.USER_CACHE_TTL_SECONDS
  },
  session: {
    maxActivePerUser: value.MAX_ACTIVE_SESSIONS_PER_USER,
    cleanupCron: value.SESSION_CLEANUP_CRON,
    cleanupBatchSize: value.SESSION_CLEANUP_BATCH_SIZE,
    retentionDays: value.SESSION_RETENTION_DAYS
  },
  redis: {
    url: value.REDIS_URL,
    keyPrefix: value.REDIS_KEY_PREFIX,
    failureCooldownMs: value.REDIS_FAILURE_COOLDOWN_MS
  },
  db: {
    host: value.DB_HOST,
    port: value.DB_PORT,
    user: value.DB_USER,
    password: value.DB_PASSWORD,
    name: value.DB_NAME,
    sync: value.DB_SYNC,
    pool: {
      max: value.DB_POOL_MAX,
      min: value.DB_POOL_MIN,
      acquire: value.DB_POOL_ACQUIRE_MS,
      idle: value.DB_POOL_IDLE_MS
    }
  },
  jwt: {
    secret: value.JWT_SECRET,
    expiresIn: value.JWT_EXPIRES_IN,
    algorithm: 'HS256'
  },
  refresh: {
    secret: value.REFRESH_TOKEN_SECRET,
    expiresIn: value.REFRESH_TOKEN_EXPIRES_IN,
    ttlDays: value.REFRESH_TOKEN_TTL_DAYS,
    algorithm: 'HS256'
  },
  firebase: {
    projectId: value.FIREBASE_PROJECT_ID,
    clientEmail: value.FIREBASE_CLIENT_EMAIL || undefined,
    privateKey: value.FIREBASE_PRIVATE_KEY
      ? value.FIREBASE_PRIVATE_KEY.replace(/\n/g, '\n')
      : undefined
  },
  socket: {
    corsOrigin: value.SOCKET_CORS_ORIGIN || '*'
  },
  matching: {
    searchRadiusKm: value.MATCHING_RADIUS_KM,
    maxInitialDrivers: value.MATCHING_MAX_INITIAL_DRIVERS,
    driverResponseTimeoutMs: value.MATCHING_DRIVER_RESPONSE_TIMEOUT_MS,
    locationThrottleMs: value.DRIVER_LOCATION_THROTTLE_MS
  },
  admin: {
    email: value.ADMIN_EMAIL,
    password: value.ADMIN_PASSWORD,
    name: value.ADMIN_NAME,
    tokenExpiresIn: value.ADMIN_TOKEN_EXPIRES_IN
  }
};
