const ApiError = require('../utils/apiError');

const deviceValidator = (req, res, next) => {
  const { device_id: deviceId, platform, app_version: appVersion } = req.body;

  if (!deviceId || typeof deviceId !== 'string' || deviceId.trim().length < 8) {
    return next(new ApiError(400, 'device_id is required'));
  }

  if (!platform || typeof platform !== 'string') {
    return next(new ApiError(400, 'platform is required'));
  }

  if (!appVersion || typeof appVersion !== 'string') {
    return next(new ApiError(400, 'app_version is required'));
  }

  req.deviceContext = {
    deviceId: deviceId.trim(),
    platform: platform.trim().toLowerCase(),
    appVersion: appVersion.trim()
  };

  return next();
};

module.exports = deviceValidator;
