// Generic middleware for validating request with Joi schemas
module.exports = (schema) => (req, res, next) => {
  if (schema.params) {
    const { error } = schema.params.validate(req.params);
    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }
  if (schema.body) {
    const { error } = schema.body.validate(req.body);
    if (error) {
      return res.status(422).json({ success: false, message: error.message });
    }
  }
  next();
};
