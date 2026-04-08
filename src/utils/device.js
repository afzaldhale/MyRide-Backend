const UAParser = require('ua-parser-js');

const normalizeDeviceType = (parsedDeviceType, platform) => {
  if (parsedDeviceType) {
    return parsedDeviceType;
  }

  if (platform === 'android' || platform === 'ios') {
    return 'mobile';
  }

  if (platform === 'web') {
    return 'desktop';
  }

  return 'unknown';
};

const getDeviceContext = ({ userAgent, platform }) => {
  const parser = new UAParser(userAgent || '');
  const result = parser.getResult();

  return {
    browser: result.browser.name || 'unknown',
    os: result.os.name || platform || 'unknown',
    deviceType: normalizeDeviceType(result.device.type, platform),
    userAgent: userAgent || null
  };
};

module.exports = {
  getDeviceContext
};
