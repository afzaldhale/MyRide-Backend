const env = require('../config/env');
const logger = require('../config/logger');
const sequelize = require('../db/sequelize');
const { closeRedisConnections } = require('../config/redis');
const { startSessionCleanupJob } = require('../jobs/sessionCleanup.job');

let task;
let shuttingDown = false;

const shutdown = async (signal) => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logger.info('Session cleanup worker shutting down', { signal });

  try {
    if (task) {
      task.stop();
      task.destroy();
    }

    await closeRedisConnections();
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    logger.error('Session cleanup worker shutdown failed', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
};

const start = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Session cleanup worker connected to MySQL', {
      env: env.nodeEnv
    });

    task = startSessionCleanupJob();
  } catch (error) {
    logger.error('Unable to start session cleanup worker', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  logger.error('Session cleanup worker unhandled rejection', {
    error: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined
  });
});
process.on('uncaughtException', (error) => {
  logger.error('Session cleanup worker uncaught exception', {
    error: error.message,
    stack: error.stack
  });
  shutdown('uncaughtException');
});

start();
