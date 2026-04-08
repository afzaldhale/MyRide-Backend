const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const env = require('../config/env');
const ApiError = require('../utils/apiError');
const { TOKEN_TYPES } = require('../utils/constants');

const buildAccessPayload = ({ user, driverProfile, sessionId }) => ({
  sub: user.id,
  role: user.role,
  driverId: driverProfile ? driverProfile.id : null,
  sid: sessionId,
  type: TOKEN_TYPES.ACCESS
});

const buildRefreshPayload = ({ user, sessionId }) => ({
  sub: user.id,
  sid: sessionId,
  type: TOKEN_TYPES.REFRESH
});

const signToken = ({ payload, secret, expiresIn, algorithm }) => {
  const jwtid = uuidv4();
  const token = jwt.sign(payload, secret, {
    expiresIn,
    algorithm,
    jwtid
  });

  const decoded = jwt.decode(token);

  return {
    token,
    payload: decoded
  };
};

const issueAccessToken = ({ user, driverProfile, sessionId }) =>
  signToken({
    payload: buildAccessPayload({ user, driverProfile, sessionId }),
    secret: env.jwt.secret,
    expiresIn: env.jwt.expiresIn,
    algorithm: env.jwt.algorithm
  });

const issueRefreshToken = ({ user, sessionId }) =>
  signToken({
    payload: buildRefreshPayload({ user, sessionId }),
    secret: env.refresh.secret,
    expiresIn: env.refresh.expiresIn,
    algorithm: env.refresh.algorithm
  });

const verifyAccessToken = (token) => {
  try {
    const payload = jwt.verify(token, env.jwt.secret, {
      algorithms: [env.jwt.algorithm]
    });

    if (payload.type !== TOKEN_TYPES.ACCESS) {
      throw new ApiError(401, 'Invalid access token type');
    }

    return payload;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(401, 'Invalid or expired authorization token');
  }
};

const verifyRefreshToken = (token) => {
  try {
    const payload = jwt.verify(token, env.refresh.secret, {
      algorithms: [env.refresh.algorithm]
    });

    if (payload.type !== TOKEN_TYPES.REFRESH) {
      throw new ApiError(401, 'Invalid refresh token type');
    }

    return payload;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(401, 'Invalid or expired refresh token');
  }
};

module.exports = {
  issueAccessToken,
  issueRefreshToken,
  verifyAccessToken,
  verifyRefreshToken
};
