const authService = require('../services/auth.service');
const { sendSuccess } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { getClientIp } = require('../utils/request');

const sendOtp = asyncHandler(async (req, res) => {
  const result = await authService.prepareOtpSession({
    body: req.body,
    ipAddress: req.otpContext?.ipAddress || getClientIp(req)
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: 'OTP can be sent',
    data: result
  });
});

const verifyOtp = asyncHandler(async (req, res) => {
  const result = await authService.verifyOtpAndLogin({
    body: req.body,
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] || null
  });

  return sendSuccess(res, {
    message: 'OTP verified successfully',
    data: result
  });
});

const googleSignin = asyncHandler(async (req, res) => {
  const result = await authService.googleSignin({
    body: req.body,
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] || null
  });

  return sendSuccess(res, {
    message: 'Google sign-in successful',
    data: result
  });
});

const refreshToken = asyncHandler(async (req, res) => {
  const result = await authService.refreshSession({
    refreshToken: req.body.refresh_token,
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] || null
  });

  return sendSuccess(res, {
    message: 'Access token refreshed successfully',
    data: result
  });
});

const logout = asyncHandler(async (req, res) => {
  await authService.logoutSession({
    userId: req.user.id,
    sessionId: req.auth.sessionId,
    tokenId: req.auth.tokenId,
    expiresAt: req.auth.expiresAt
  });

  return sendSuccess(res, {
    message: 'Logged out successfully',
    data: null
  });
});

const logoutAll = asyncHandler(async (req, res) => {
  await authService.logoutAllSessions({
    userId: req.user.id,
    tokenId: req.auth.tokenId,
    expiresAt: req.auth.expiresAt
  });

  return sendSuccess(res, {
    message: 'Logged out from all devices successfully',
    data: null
  });
});

module.exports = {
  sendOtp,
  verifyOtp,
  refreshToken,
  logout,
  logoutAll
};
