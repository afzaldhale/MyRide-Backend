const env = require('../config/env');
const { getRedisCommandClient } = require('../config/redis');
const { CACHE_KEYS } = require('../utils/constants');

const fallbackStore = new Map();

const getFallbackEntry = (key) => {
  const entry = fallbackStore.get(key);
  if (!entry || entry.expiresAt < Date.now()) {
    fallbackStore.delete(key);
    return null;
  }
  return entry;
};

const apiRateLimiter = async (req, res, next) => {
  const identifier = req.ip || req.requestId || 'anonymous';
  const key = `${CACHE_KEYS.RATE_LIMIT}:api:${identifier}`;
  const windowSeconds = Math.ceil(env.rateLimit.windowMs / 1000);

  try {
    const redis = await getRedisCommandClient();

    if (redis) {
      const currentCount = await redis.incr(key);
      if (currentCount === 1) {
        await redis.expire(key, windowSeconds);
      }

      const ttlSeconds = await redis.ttl(key);

      res.setHeader('x-ratelimit-limit', env.rateLimit.maxRequests);
      res.setHeader('x-ratelimit-remaining', Math.max(env.rateLimit.maxRequests - currentCount, 0));
      res.setHeader('x-ratelimit-reset', ttlSeconds);

      if (currentCount > env.rateLimit.maxRequests) {
        return res.status(429).json({
          success: false,
          message: 'Too many requests. Please try again later.',
          errors: null,
          meta: {
            request_id: req.requestId,
            timestamp: new Date().toISOString()
          }
        });
      }

      return next();
    }

    const entry = getFallbackEntry(key);
    const now = Date.now();
    const current = entry
      ? { ...entry, count: entry.count + 1 }
      : { count: 1, expiresAt: now + env.rateLimit.windowMs };

    fallbackStore.set(key, current);

    res.setHeader('x-ratelimit-limit', env.rateLimit.maxRequests);
    res.setHeader('x-ratelimit-remaining', Math.max(env.rateLimit.maxRequests - current.count, 0));
    res.setHeader('x-ratelimit-reset', Math.ceil((current.expiresAt - now) / 1000));

    if (current.count > env.rateLimit.maxRequests) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.',
        errors: null,
        meta: {
          request_id: req.requestId,
          timestamp: new Date().toISOString()
        }
      });
    }

    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  apiRateLimiter
};
