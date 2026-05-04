const Joi = require('joi');

const driverSchemas = {
  submitKyc: {
    body: Joi.object({
      fullName: Joi.string().trim().min(2).max(120).required(),
      phoneNumber: Joi.string().trim().min(10).max(16).required(),
      vehicleType: Joi.string().trim().min(2).max(80).required(),
      vehicleNumber: Joi.string().trim().min(4).max(50).required(),
      licenseNumber: Joi.string().trim().min(6).max(80).required()
    })
  },
  setOnlineStatus: {
    body: Joi.object({
      is_online: Joi.boolean().required()
    })
  },
  rideIdParam: {
    params: Joi.object({
      id: Joi.string().guid({ version: ['uuidv4', 'uuidv5'] }).required()
    })
  },
  startRide: {
    body: Joi.object({
      ride_otp: Joi.string().trim().length(4).required()
    }),
    params: Joi.object({
      id: Joi.string().guid({ version: ['uuidv4', 'uuidv5'] }).required()
    })
  },
  updateRideStatus: {
    body: Joi.object({
      status: Joi.string()
        .valid('driver_arriving', 'arrived', 'in_progress', 'completed')
        .required()
    }),
    params: Joi.object({
      id: Joi.string().guid({ version: ['uuidv4', 'uuidv5'] }).required()
    })
  }
};

module.exports = driverSchemas;
