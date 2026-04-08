const { sequelize } = require('../models');
const { getRedisHealth } = require('../config/redis');

const getHealthStatus = async () => {
  const [database, redis] = await Promise.all([
    sequelize
      .authenticate()
      .then(() => ({ status: 'up' }))
      .catch((error) => ({ status: 'down', error: error.message })),
    getRedisHealth()
  ]);

  const isHealthy = database.status === 'up' && redis.status !== 'down';

  return {
    status: isHealthy ? 'ok' : 'degraded',
    uptime_seconds: Math.floor(process.uptime()),
    database,
    redis
  };
};

module.exports = {
  getHealthStatus
};
