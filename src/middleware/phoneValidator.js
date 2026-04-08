const ApiError = require('../utils/apiError');
const { assertValidIndianPhone } = require('../utils/phone');

const phoneValidator = (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone || typeof phone !== 'string') {
      throw new ApiError(400, 'phone is required');
    }

    req.phoneContext = assertValidIndianPhone(phone);
    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = phoneValidator;
