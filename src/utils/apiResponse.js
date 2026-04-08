const sendSuccess = (res, { statusCode = 200, message = 'Success', data = null, meta = null }) =>
  res.status(statusCode).json({
    success: true,
    message,
    data,
    meta: {
      request_id: res.req.requestId,
      timestamp: new Date().toISOString(),
      ...meta
    }
  });

const sendError = (res, { statusCode = 500, message = 'Internal server error', errors = null }) =>
  res.status(statusCode).json({
    success: false,
    message,
    errors,
    meta: {
      request_id: res.req.requestId,
      timestamp: new Date().toISOString()
    }
  });

module.exports = {
  sendSuccess,
  sendError
};
