const logger = require('../config/logger');
const { sendError } = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');

const mapKnownError = (error) => {
  if (error instanceof ApiError) {
    return error;
  }

  if (error.name === 'SequelizeValidationError') {
    return new ApiError(400, 'Database validation failed', {
      fields: error.errors.map((item) => ({
        path: item.path,
        message: item.message
      }))
    });
  }

  if (error.name === 'SequelizeUniqueConstraintError') {
    return new ApiError(409, 'A unique value already exists', {
      fields: error.errors.map((item) => ({
        path: item.path,
        message: item.message
      }))
    });
  }

  if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    return new ApiError(401, 'Invalid or expired authorization token');
  }

  return new ApiError(500, 'Internal server error');
};

const notFoundHandler = (req, res, next) =>
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));

const errorHandler = (error, req, res, next) => {
  const normalizedError = mapKnownError(error);
  const statusCode = normalizedError.statusCode || 500;
  const isOperational = normalizedError instanceof ApiError && statusCode < 500;

  logger.error('Request failed', {
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
    statusCode,
    message: error.message,
    stack: error.stack,
    details: error.details || null
  });

  return sendError(res, {
    statusCode,
    message:
      statusCode >= 500 && req.app.get('env') === 'production'
        ? 'Internal server error'
        : normalizedError.message,
    errors:
      statusCode >= 500 && req.app.get('env') === 'production' && !isOperational
        ? null
        : normalizedError.details || null
  });
};

module.exports = {
  notFoundHandler,
  errorHandler
};
