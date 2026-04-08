const ApiError = require('../utils/apiError');

const indianPhoneRegex = /^[6-9][0-9]{9}$/;

const normalizeIndianPhone = (value) => {
  const digits = String(value || '').replace(/\D/g, '');

  if (digits.length === 10) {
    return {
      local: digits,
      e164: `+91${digits}`
    };
  }

  if (digits.length === 12 && digits.startsWith('91')) {
    const local = digits.slice(2);
    return {
      local,
      e164: `+${digits}`
    };
  }

  throw new ApiError(400, 'Please enter a valid Indian mobile number');
};

const assertValidIndianPhone = (value) => {
  const normalized = normalizeIndianPhone(value);

  if (!indianPhoneRegex.test(normalized.local)) {
    throw new ApiError(400, 'Please enter a valid Indian mobile number');
  }

  return normalized;
};

module.exports = {
  indianPhoneRegex,
  normalizeIndianPhone,
  assertValidIndianPhone
};
