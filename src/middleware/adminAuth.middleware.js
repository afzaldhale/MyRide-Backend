const jwt = require('jsonwebtoken');

const env = require('../config/env');
const ApiError = require('../utils/apiError');

const extractBearerToken = (authHeader) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new ApiError(401, 'Authorization token is required');
  }

  return authHeader.split(' ')[1];
};

const authenticateAdmin = (req, res, next) => {
  try {
    const token = extractBearerToken(req.headers.authorization);
    const payload = jwt.verify(token, env.jwt.secret, {
      algorithms: [env.jwt.algorithm]
    });

    if (payload.role !== 'admin') {
      throw new ApiError(403, 'Admin access required');
    }

    req.admin = {
      token,
      payload
    };

    return next();
  } catch (error) {
    return next(error instanceof ApiError ? error : new ApiError(401, 'Invalid admin token'));
  }
};

module.exports = {
  authenticateAdmin
};
