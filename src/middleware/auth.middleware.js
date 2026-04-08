const userRepository = require('../repositories/user.repository');
const ApiError = require('../utils/apiError');
const cacheService = require('../services/cache.service');
const sessionService = require('../services/session.service');
const tokenService = require('../services/token.service');
const { TOKEN_TYPES } = require('../utils/constants');

const extractBearerToken = (authHeader) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new ApiError(401, 'Authorization token is required');
  }

  return authHeader.split(' ')[1];
};

const authenticate = async (req, res, next) => {
  try {
    const token = extractBearerToken(req.headers.authorization);
    const decoded = tokenService.verifyAccessToken(token);

    if (decoded.type !== TOKEN_TYPES.ACCESS) {
      throw new ApiError(401, 'Invalid authorization token type');
    }

    if (await cacheService.isAccessTokenBlacklisted(decoded.jti)) {
      throw new ApiError(401, 'Authorization token has been invalidated');
    }

    const session = await sessionService.getActiveSessionOrFail(decoded.sid, decoded.sub);
    const user = await userRepository.findAuthUserById(decoded.sub);

    if (!user) {
      throw new ApiError(401, 'Invalid authorization token');
    }

    req.user = user;
    req.auth = {
      token,
      tokenId: decoded.jti,
      sessionId: decoded.sid,
      expiresAt: decoded.exp,
      session,
      payload: decoded
    };

    return next();
  } catch (error) {
    return next(error);
  }
};

const authorizeRoles = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new ApiError(403, 'You do not have permission to access this resource'));
  }

  return next();
};

module.exports = {
  authenticate,
  authorizeRoles,
  extractBearerToken
};
