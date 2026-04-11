const Joi = require('joi');

const phoneRegex = /^\+91[6-9]\d{9}$/;

const authSchemas = {
  sendOtp: {
    body: Joi.object({
      phone: Joi.string().pattern(phoneRegex).required(),
      device_id: Joi.string().trim().min(8).max(191).required(),
      platform: Joi.string().trim().valid('android', 'ios', 'web').required(),
      app_version: Joi.string().trim().max(32).required()
    })
  },
  verifyOtp: {
    body: Joi.object({
      firebase_token: Joi.string().trim().required(),
      role: Joi.string().valid('rider', 'driver').required(),
      phone_number: Joi.string().pattern(phoneRegex).optional(),
      device_id: Joi.string().trim().min(8).max(191).optional(),
      platform: Joi.string().trim().valid('android', 'ios', 'web').optional(),
      app_version: Joi.string().trim().max(32).optional()
    })
  },
  refreshToken: {
    body: Joi.object({
      refresh_token: Joi.string().trim().required()
    })
  },
  googleSignin: {
    body: Joi.object({
      firebase_token: Joi.string().trim().required(),
      role: Joi.string().valid('rider', 'driver').required(),
      device_id: Joi.string().trim().min(8).max(191).required(),
      platform: Joi.string().trim().valid('android', 'ios', 'web').required(),
      app_version: Joi.string().trim().max(32).required()
    })
  }

module.exports = authSchemas;
