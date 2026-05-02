const Joi = require('joi');

const adminSchemas = {
  updateDriverKyc: {
    params: Joi.object({
      id: Joi.string().guid({ version: ['uuidv4', 'uuidv5'] }).required()
    }),
    body: Joi.object({
      status: Joi.string().valid('approved', 'rejected').required(),
      rejectionReason: Joi.string().allow('', null).max(255)
    })
  }
};

module.exports = adminSchemas;
