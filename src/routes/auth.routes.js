const express = require('express');

const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');
const deviceValidator = require('../middleware/deviceValidator');
const otpRateLimiter = require('../middleware/otpRateLimiter');
const phoneValidator = require('../middleware/phoneValidator');
const validateSchema = require('../middleware/validate.middleware');
const authSchemas = require('../validators/auth.validator');

const router = express.Router();

// Debug checks
console.log("sendOtp:", typeof authController.sendOtp);
console.log("verifyOtp:", typeof authController.verifyOtp);
console.log("googleSignin:", typeof authController.googleSignin);
console.log("refreshToken:", typeof authController.refreshToken);
console.log("logout:", typeof authController.logout);
console.log("logoutAll:", typeof authController.logoutAll);

router.post(
  '/send-otp',
  validateSchema(authSchemas.sendOtp),
  phoneValidator,
  deviceValidator,
  otpRateLimiter,
  authController.sendOtp
);

router.post(
  '/verify-otp',
  validateSchema(authSchemas.verifyOtp),
  authController.verifyOtp
);

router.post(
  '/google-signin',
  validateSchema(authSchemas.googleSignin),
  deviceValidator,
  authController.googleSignin
);

router.post(
  '/refresh-token',
  validateSchema(authSchemas.refreshToken),
  authController.refreshToken
);

router.post(
  '/logout',
  authenticate,
  authController.logout
);

router.post(
  '/logout-all',
  authenticate,
  authController.logoutAll
);

module.exports = router;