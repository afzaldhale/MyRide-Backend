const ApiError = require('../utils/apiError');

const validateSchema = (schema) => (req, res, next) => {
  try {
    if (schema.body) {
      const { value, error } = schema.body.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
        convert: true
      });

      if (error) {
        throw error;
      }

      req.body = value;
    }

    if (schema.params) {
      const { value, error } = schema.params.validate(req.params, {
        abortEarly: false,
        stripUnknown: true,
        convert: true
      });

      if (error) {
        throw error;
      }

      req.params = value;
    }

    if (schema.query) {
      const { value, error } = schema.query.validate(req.query, {
        abortEarly: false,
        stripUnknown: true,
        convert: true
      });

      if (error) {
        throw error;
      }

      req.query = value;
    }

    return next();
  } catch (error) {
    if (error.isJoi) {
      return next(
        new ApiError(400, 'Validation failed', {
          fields: error.details.map((detail) => ({
            message: detail.message,
            path: detail.path.join('.')
          }))
        })
      );
    }

    return next(error);
  }
};

module.exports = validateSchema;
