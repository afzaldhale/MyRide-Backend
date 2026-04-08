const healthService = require('../services/health.service');
const { sendSuccess } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

const getHealth = asyncHandler(async (req, res) => {
  const health = await healthService.getHealthStatus();

  return sendSuccess(res, {
    statusCode: health.status === 'ok' ? 200 : 503,
    message: 'Backend health status fetched successfully',
    data: health
  });
});

module.exports = {
  getHealth
};
