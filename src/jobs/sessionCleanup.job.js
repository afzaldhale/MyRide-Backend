const cron = require('node-cron');

const env = require('../config/env');
const logger = require('../config/logger');
const sessionService = require('../services/session.service');

const runSessionCleanup = async () => {
  try {
    const result = await sessionService.cleanupExpiredSessions();
    if (result.deletedCount > 0) {
      logger.info('Session cleanup job completed', result);
    }

    return result;
  } catch (error) {
    logger.error('Session cleanup job failed', {
      error: error.message,
      stack: error.stack
    });
    return {
      deletedCount: 0,
      error: error.message
    };
  }
};

const startSessionCleanupJob = () => {
  const task = cron.schedule(env.session.cleanupCron, () => {
    runSessionCleanup();
  });

  logger.info('Session cleanup job scheduled', {
    cron: env.session.cleanupCron,
    batchSize: env.session.cleanupBatchSize,
    retentionDays: env.session.retentionDays
  });

  return task;
};

module.exports = {
  runSessionCleanup,
  startSessionCleanupJob
};
