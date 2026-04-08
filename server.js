const app = require('./src/app');
const env = require('./src/config/env');
const logger = require('./src/config/logger');
const { closeRedisConnections } = require('./src/config/redis');
const { sequelize } = require('./src/models');
const { createHttpServer } = require('./src/services/socket.service');

let httpServer;
let shuttingDown = false;

const gracefulShutdown = async (signal) => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logger.info('Shutdown signal received', { signal });

  const forceExitTimer = setTimeout(() => {
    logger.error('Forced shutdown after timeout', {
      timeoutMs: env.app.shutdownTimeoutMs
    });
    process.exit(1);
  }, env.app.shutdownTimeoutMs);

  forceExitTimer.unref();

  try {
    if (httpServer) {
      await new Promise((resolve, reject) => {
        httpServer.close((error) => {
          if (error) {
            return reject(error);
          }
          return resolve();
        });
      });
    }

    await closeRedisConnections();
    await sequelize.close();
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Graceful shutdown failed', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
};

const startServer = async () => {
  try {
    await sequelize.authenticate();
    logger.info('MySQL connection established successfully');

    if (env.db.sync && env.nodeEnv !== 'production') {
      await sequelize.sync();
      logger.warn('Database schema synchronized via sequelize.sync()', {
        warning: 'Prefer migrations for all production schema changes, including auth_sessions.'
      });
    } else if (env.db.sync && env.nodeEnv === 'production') {
      logger.warn('DB_SYNC ignored in production', {
        warning: 'Run migrations instead of sequelize.sync() in production.'
      });
    }

    httpServer = await createHttpServer(app);

    httpServer.listen(env.port, () => {
      logger.info('Backend service listening', {
        port: env.port,
        env: env.nodeEnv
      });
    });
  } catch (error) {
    logger.error('Unable to start backend service', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', {
    error: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined
  });
});
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', {
    error: error.message,
    stack: error.stack
  });
  gracefulShutdown('uncaughtException');
});

startServer();
