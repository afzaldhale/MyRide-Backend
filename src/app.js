const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');

const env = require('./config/env');
const logger = require('./config/logger');
const requestContext = require('./middleware/requestContext.middleware');
const { apiRateLimiter } = require('./middleware/rateLimit.middleware');
const apiRoutes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middleware/error.middleware');

const app = express();

app.set('env', env.nodeEnv);
if (env.app.trustProxy !== false) {
  app.set('trust proxy', env.app.trustProxy);
}

app.disable('x-powered-by');
app.use(requestContext);
app.use(
  helmet({
    crossOriginResourcePolicy: false
  })
);
app.use(
  cors({
    origin(origin, callback) {
      if (env.cors.allowAll || !origin) {
        return callback(null, true);
      }

      return callback(null, env.cors.origins.includes(origin));
    },
    credentials: true
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(apiRateLimiter);

morgan.token('request-id', (req) => req.requestId);
app.use(
  morgan(':method :url :status :response-time ms - :res[content-length] req_id=:request-id', {
    stream: logger.stream
  })
);

app.use('/api', apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
