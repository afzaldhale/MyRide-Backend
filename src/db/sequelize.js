const { Sequelize } = require('sequelize');

const env = require('../config/env');
const logger = require('../config/logger');

const sequelize = new Sequelize(env.db.name, env.db.user, env.db.password, {
  host: env.db.host,
  port: env.db.port,
  dialect: 'mysql',
  logging:
    env.nodeEnv === 'development'
      ? (message) => logger.debug(message)
      : false,
  pool: env.db.pool,
  dialectOptions: {
    decimalNumbers: true
  },
  define: {
    freezeTableName: true,
    underscored: true
  }
});

module.exports = sequelize;
