const Joi = require('joi');

const driverSchemas = {
  submitKyc: {
    body: Joi.object({
      vehicle_type: Joi.string().trim().min(2).max(80).required(),
      vehicle_number: Joi.string().trim().min(4).max(50).required(),
      license_number: Joi.string().trim().min(6).max(80).required()
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
  }
};

module.exports = driverSchemas;
