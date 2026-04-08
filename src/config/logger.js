const { createLogger, format, transports } = require('winston');

const env = require('./env');

const logger = createLogger({
  level: env.logLevel,
  defaultMeta: {
    service: env.app.name,
    version: env.app.version,
    env: env.nodeEnv
  },
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  transports: [
    new transports.Console({
      stderrLevels: ['error']
    })
  ]
});

logger.stream = {
  write: (message) => {
    const line = message.trim();
    if (line) {
      logger.http(line);
    }
  }
};

module.exports = logger;
