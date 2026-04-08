const otpRepository = require('../repositories/otp.repository');
const ApiError = require('../utils/apiError');
const { OTP_ATTEMPT_TYPES, OTP_LIMITS } = require('../utils/constants');
const { getClientIp } = require('../utils/request');

const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60 * 1000);

const otpRateLimiter = async (req, res, next) => {
  try {
    const phoneNumber = req.phoneContext?.e164;
    const deviceId = req.deviceContext?.deviceId;
    const ipAddress = getClientIp(req);

    const [phoneAttempts, ipAttempts, deviceAttempts] = await Promise.all([
      otpRepository.countAttemptsSince({
        where: {
          phoneNumber,
          attemptType: OTP_ATTEMPT_TYPES.SEND,
          createdAt: {
            [otpRepository.Op.gte]: minutesAgo(OTP_LIMITS.PHONE_SEND_WINDOW_MINUTES)
          }
        }
      }),
      otpRepository.countAttemptsSince({
        where: {
          ipAddress,
          attemptType: OTP_ATTEMPT_TYPES.SEND,
          createdAt: {
            [otpRepository.Op.gte]: minutesAgo(OTP_LIMITS.IP_SEND_WINDOW_MINUTES)
          }
        }
      }),
      otpRepository.countAttemptsSince({
        where: {
          deviceId,
          attemptType: OTP_ATTEMPT_TYPES.SEND,
          createdAt: {
            [otpRepository.Op.gte]: minutesAgo(OTP_LIMITS.DEVICE_SEND_WINDOW_MINUTES)
          }
        }
      })
    ]);

    await otpRepository.createAttempt({
      phoneNumber,
      ipAddress,
      deviceId,
      attemptType: OTP_ATTEMPT_TYPES.SEND
    });

    if (
      phoneAttempts >= OTP_LIMITS.PHONE_SEND_MAX ||
      ipAttempts >= OTP_LIMITS.IP_SEND_MAX ||
      deviceAttempts >= OTP_LIMITS.DEVICE_SEND_MAX
    ) {
      await otpRepository.createLog({
        phone: phoneNumber,
        ip: ipAddress,
        device: deviceId,
        status: 'otp_send_rate_limited'
      });
      throw new ApiError(429, 'Too many OTP requests. Try again later.');
    }

    req.otpContext = {
      ...(req.otpContext || {}),
      ipAddress,
      phoneNumber,
      deviceId
    };

    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = otpRateLimiter;
