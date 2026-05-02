const Joi = require('joi');

const coordinateRule = Joi.number().min(-180).max(180).required();

const rideSchemas = {
  requestRide: {
    body: Joi.object({
      pickup_lat: Joi.number().min(-90).max(90).required(),
      pickup_lng: coordinateRule,
      drop_lat: Joi.number().min(-90).max(90).required(),
      drop_lng: coordinateRule,
      pickup_address: Joi.string().trim().max(255).allow('', null).optional(),
      drop_address: Joi.string().trim().max(255).allow('', null).optional(),
      fare: Joi.number().min(0).optional(),
      vehicleType: Joi.string()
        .valid('auto', 'economy', 'comfort', 'premium', 'xl', 'mini', 'sedan')
        .optional()
        .insensitive()
    })
  },
  rideIdParam: {
    params: Joi.object({
      id: Joi.string().guid({ version: ['uuidv4', 'uuidv5'] }).required()
    })
  }
};

module.exports = rideSchemas;
