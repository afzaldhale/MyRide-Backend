const Redis = require('ioredis');

const env = require('./env');
const logger = require('./logger');

let commandClient = null;
let pubClient = null;
let subClient = null;
let adapterReady = false;
let redisDisabledUntil = 0;

const isRedisTemporarilyDisabled = () => redisDisabledUntil > Date.now();

const markRedisFailure = (error, scope) => {
  redisDisabledUntil = Date.now() + env.redis.failureCooldownMs;
  logger.warn('Redis unavailable, falling back to local memory', {
    scope,
    cooldownMs: env.redis.failureCooldownMs,
    error: error.message
  });
};

const buildRedisClient = (connectionName) =>
  new Redis(env.redis.url, {
    keyPrefix: env.redis.keyPrefix,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
    connectionName
  });

const connectClient = async (client, scope) => {
  if (client.status === 'ready' || client.status === 'connect') {
    return client;
  }

  try {
    await client.connect();
    return client;
  } catch (error) {
    markRedisFailure(error, scope);
    return null;
  }
};

const getRedisCommandClient = async () => {
  if (!env.redis.url || isRedisTemporarilyDisabled()) {
    return null;
  }

  if (!commandClient) {
    commandClient = buildRedisClient('backend-command');
    commandClient.on('error', (error) => {
      logger.warn('Redis command client error', { error: error.message });
    });
  }

  return connectClient(commandClient, 'command');
};

const getRedisPubSubClients = async () => {
  if (!env.redis.url || isRedisTemporarilyDisabled()) {
    return null;
  }

  if (!adapterReady) {
    pubClient = pubClient || buildRedisClient('socket-pub');
    subClient = subClient || buildRedisClient('socket-sub');

    pubClient.on('error', (error) => {
      logger.warn('Redis pub client error', { error: error.message });
    });
    subClient.on('error', (error) => {
      logger.warn('Redis sub client error', { error: error.message });
    });

    const [pubReady, subReady] = await Promise.all([
      connectClient(pubClient, 'socket-pub'),
      connectClient(subClient, 'socket-sub')
    ]);

    if (!pubReady || !subReady) {
      return null;
    }

    adapterReady = true;
  }

  return {
    pubClient,
    subClient
  };
};

const closeRedisConnections = async () => {
  const clients = [commandClient, pubClient, subClient].filter(Boolean);
  await Promise.all(
    clients.map(async (client) => {
      try {
        await client.quit();
      } catch (error) {
        logger.warn('Redis client quit failed', {
          error: error.message
        });
      }
    })
  );
};

const getRedisHealth = async () => {
  if (!env.redis.url) {
    return {
      enabled: false,
      status: 'disabled'
    };
  }

  if (isRedisTemporarilyDisabled()) {
    return {
      enabled: true,
      status: 'degraded',
      fallback: 'memory'
    };
  }

  try {
    const client = await getRedisCommandClient();
    if (!client) {
      return {
        enabled: true,
        status: 'degraded',
        fallback: 'memory'
      };
    }

    const response = await client.ping();

    return {
      enabled: true,
      status: response === 'PONG' ? 'up' : 'degraded'
    };
  } catch (error) {
    markRedisFailure(error, 'health');
    return {
      enabled: true,
      status: 'down',
      fallback: 'memory',
      error: error.message
    };
  }
};

module.exports = {
  getRedisCommandClient,
  getRedisPubSubClients,
  closeRedisConnections,
  getRedisHealth
};
