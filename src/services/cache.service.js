const env = require('../config/env');
const logger = require('../config/logger');
const { getRedisCommandClient } = require('../config/redis');
const { CACHE_KEYS } = require('../utils/constants');

const memoryStore = new Map();

const buildKey = (namespace, key) => `${namespace}:${key}`;

const getLocalValue = (storageKey) => {
  const local = memoryStore.get(storageKey);
  if (!local || local.expiresAt < Date.now()) {
    memoryStore.delete(storageKey);
    return null;
  }

  return local.value;
};

const setLocalValue = (storageKey, value, ttlSeconds) => {
  memoryStore.set(storageKey, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000
  });
};

const deleteLocalValue = (storageKey) => {
  memoryStore.delete(storageKey);
};

const withRedisFallback = async (operation, fallback, scope) => {
  try {
    const redis = await getRedisCommandClient();
    if (!redis) {
      return fallback(null);
    }

    return await operation(redis);
  } catch (error) {
    logger.warn('Redis cache operation failed, using memory fallback', {
      scope,
      error: error.message
    });
    return fallback(null);
  }
};

const getJson = async (namespace, key) => {
  const storageKey = buildKey(namespace, key);

  return withRedisFallback(
    async (redis) => {
      const raw = await redis.get(storageKey);
      return raw ? JSON.parse(raw) : null;
    },
    async () => getLocalValue(storageKey),
    'getJson'
  );
};

const setJson = async (namespace, key, value, ttlSeconds) => {
  const storageKey = buildKey(namespace, key);

  return withRedisFallback(
    async (redis) => {
      await redis.set(storageKey, JSON.stringify(value), 'EX', ttlSeconds);
    },
    async () => {
      setLocalValue(storageKey, value, ttlSeconds);
    },
    'setJson'
  );
};

const deleteKey = async (namespace, key) => {
  const storageKey = buildKey(namespace, key);

  return withRedisFallback(
    async (redis) => {
      await redis.del(storageKey);
    },
    async () => {
      deleteLocalValue(storageKey);
    },
    'deleteKey'
  );
};

const setValue = async (namespace, key, value, ttlSeconds) => {
  const storageKey = buildKey(namespace, key);

  return withRedisFallback(
    async (redis) => {
      await redis.set(storageKey, value, 'EX', ttlSeconds);
    },
    async () => {
      setLocalValue(storageKey, value, ttlSeconds);
    },
    'setValue'
  );
};

const exists = async (namespace, key) => {
  const storageKey = buildKey(namespace, key);

  return withRedisFallback(
    async (redis) => (await redis.exists(storageKey)) === 1,
    async () => Boolean(getLocalValue(storageKey)),
    'exists'
  );
};

const setCachedSession = (session) =>
  setJson(CACHE_KEYS.SESSION, session.id, session, env.cache.sessionTtlSeconds);

const getCachedSession = (sessionId) => getJson(CACHE_KEYS.SESSION, sessionId);

const invalidateSessionCache = (sessionId) => deleteKey(CACHE_KEYS.SESSION, sessionId);

const setCachedAuthUser = (user) =>
  setJson(CACHE_KEYS.AUTH_USER, user.id, user, env.cache.userTtlSeconds);

const getCachedAuthUser = (userId) => getJson(CACHE_KEYS.AUTH_USER, userId);

const invalidateAuthUserCache = (userId) => deleteKey(CACHE_KEYS.AUTH_USER, userId);

const blacklistAccessToken = async (tokenId, expiresAtEpochSeconds) => {
  if (!tokenId || !expiresAtEpochSeconds) {
    return;
  }

  const ttlSeconds = Math.max(expiresAtEpochSeconds - Math.floor(Date.now() / 1000), 1);
  await setValue(CACHE_KEYS.ACCESS_BLACKLIST, tokenId, '1', ttlSeconds);
};

const isAccessTokenBlacklisted = (tokenId) => exists(CACHE_KEYS.ACCESS_BLACKLIST, tokenId);

module.exports = {
  getJson,
  setJson,
  deleteKey,
  setValue,
  exists,
  setCachedSession,
  getCachedSession,
  invalidateSessionCache,
  setCachedAuthUser,
  getCachedAuthUser,
  invalidateAuthUserCache,
  blacklistAccessToken,
  isAccessTokenBlacklisted
};
