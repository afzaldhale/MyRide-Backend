const admin = require('../config/firebase');
const logger = require('../config/logger');
const sequelize = require('../db/sequelize');
const driverRepository = require('../repositories/driver.repository');
const otpRepository = require('../repositories/otp.repository');
const userRepository = require('../repositories/user.repository');
const ApiError = require('../utils/apiError');
const { hashToken } = require('../utils/crypto');
const { assertValidIndianPhone } = require('../utils/phone');
const { getDeviceContext } = require('../utils/device');
const tokenService = require('./token.service');
const sessionService = require('./session.service');
const cacheService = require('./cache.service');
const { OTP_ATTEMPT_TYPES, OTP_LIMITS, USER_ROLES } = require('../utils/constants');
const { v4: uuidv4 } = require('uuid');

const createOtpAuditLog = ({ phone, ip, device, status }, transaction) => {
  logger.info('OTP event', { phone, ip, device, status });
  return otpRepository.createLog(
    {
      phone,
      ip,
      device,
      status
    },
    transaction
  );
};

const buildAuthPayload = ({ user, driverProfile, accessToken, refreshToken, session }) => ({
  access_token: accessToken.token,
  refresh_token: refreshToken.token,
  token_type: 'Bearer',
  expires_in: Math.max(accessToken.payload.exp - Math.floor(Date.now() / 1000), 0),
  session: {
    id: session.id,
    device_id: session.deviceId,
    device_type: session.deviceType,
    platform: session.platform,
    app_version: session.appVersion,
    ip_address: session.ipAddress,
    expires_at: session.expiresAt,
    last_used_at: session.lastUsedAt,
    last_rotated_at: session.lastRotatedAt,
    revoked_at: session.revokedAt
  },
  user: {
    id: user.id,
    phone_number: user.phoneNumber,
    role: user.role,
    name: user.name,
    profile_photo: user.profilePhoto
  },
  driver: driverProfile
    ? {
        id: driverProfile.id,
        kyc_status: driverProfile.kycStatus,
        is_online: driverProfile.isOnline,
        vehicle_type: driverProfile.vehicleType,
        vehicle_number: driverProfile.vehicleNumber
      }
    : null
});

const prepareOtpSession = async ({ body, ipAddress }) => {
  const normalizedPhone = assertValidIndianPhone(body.phone);
  const deviceId = String(body.device_id).trim();
  const platform = String(body.platform).trim().toLowerCase();
  const appVersion = String(body.app_version).trim();
  const requestIp = ipAddress || 'unknown';
  const verificationId = uuidv4();
  const expiresAt = new Date(Date.now() + OTP_LIMITS.SESSION_TTL_MINUTES * 60 * 1000);

  return sequelize.transaction(async (transaction) => {
    await otpRepository.expireExistingSessions(
      {
        phoneNumber: normalizedPhone.e164,
        deviceId
      },
      transaction
    );

    const session = await otpRepository.createSession(
      {
        phoneNumber: normalizedPhone.e164,
        verificationId,
        deviceId,
        platform,
        appVersion,
        expiresAt
      },
      transaction
    );

    await createOtpAuditLog(
      {
        phone: normalizedPhone.e164,
        ip: requestIp,
        device: deviceId,
        status: 'otp_send_allowed'
      },
      transaction
    );

    return {
      session_id: session.id,
      expires_at: session.expiresAt,
      cooldown_seconds: 30,
      message:
        'OTP request accepted. Proceed with Firebase Phone Authentication on the client.'
    };
  });
};

const verifyOtpAndLogin = async ({ body, ipAddress, userAgent }) => {
  const requestIp = ipAddress || 'unknown';
  const deviceId = body.device_id ? String(body.device_id).trim() : 'unknown-device';
  const platform = body.platform ? String(body.platform).trim().toLowerCase() : 'unknown';
  const appVersion = body.app_version ? String(body.app_version).trim() : 'unknown';
  const normalizedRequestPhone = body.phone_number
    ? assertValidIndianPhone(body.phone_number)
    : null;
  const deviceContext = getDeviceContext({
    userAgent,
    platform
  });

  await otpRepository.createAttempt({
    phoneNumber: normalizedRequestPhone?.e164 || 'unknown',
    ipAddress: requestIp,
    deviceId,
    attemptType: OTP_ATTEMPT_TYPES.VERIFY
  });

  let decodedToken;

  try {
    decodedToken = await admin.auth().verifyIdToken(body.firebase_token);
  } catch (error) {
    await createOtpAuditLog({
      phone: normalizedRequestPhone?.e164 || 'unknown',
      ip: requestIp,
      device: deviceId,
      status: 'otp_verify_invalid_firebase_token'
    });
    throw new ApiError(401, 'Invalid Firebase ID token', {
      reason: error.message
    });
  }

  const tokenPhoneNumber = decodedToken.phone_number;

  if (!tokenPhoneNumber) {
    throw new ApiError(400, 'Firebase token does not contain a phone number');
  }

  const normalizedPhone = assertValidIndianPhone(body.phone_number || tokenPhoneNumber);
  if (normalizedPhone.e164 !== tokenPhoneNumber) {
    await createOtpAuditLog({
      phone: normalizedPhone.e164,
      ip: requestIp,
      device: deviceId,
      status: 'otp_verify_phone_mismatch'
    });
    throw new ApiError(400, 'Phone number mismatch detected');
  }

  const result = await sequelize.transaction(async (transaction) => {
    const otpSession = await otpRepository.findActiveSession({
      phoneNumber: normalizedPhone.e164,
      deviceId
    });

    if (!otpSession) {
      await createOtpAuditLog(
        {
          phone: normalizedPhone.e164,
          ip: requestIp,
          device: deviceId,
          status: 'otp_session_missing'
        },
        transaction
      );
      throw new ApiError(401, 'OTP session expired. Please request a new code.');
    }

    if (otpSession.attemptCount >= OTP_LIMITS.MAX_VERIFY_ATTEMPTS) {
      await otpRepository.expireSession(otpSession, transaction);
      await createOtpAuditLog(
        {
          phone: normalizedPhone.e164,
          ip: requestIp,
          device: deviceId,
          status: 'otp_verify_blocked_max_attempts'
        },
        transaction
      );
      throw new ApiError(429, 'Maximum OTP verification attempts exceeded.');
    }

    await otpRepository.incrementSessionAttemptCount(otpSession, transaction);

    let user = await userRepository.findByPhoneNumber(normalizedPhone.e164, transaction);

    if (user && user.role !== body.role) {
      await createOtpAuditLog(
        {
          phone: normalizedPhone.e164,
          ip: requestIp,
          device: deviceId,
          status: 'otp_verify_role_conflict'
        },
        transaction
      );
      throw new ApiError(409, `This phone number is already registered as a ${user.role}`);
    }

    if (!user) {
      user = await userRepository.createUser(
        {
          phoneNumber: normalizedPhone.e164,
          role: body.role
        },
        transaction
      );

      if (body.role === USER_ROLES.DRIVER) {
        const createdDriverProfile = await driverRepository.createDriverProfile(
          {
            userId: user.id
          },
          transaction
        );
        user.setDataValue('driverProfile', createdDriverProfile);
      }
    }

    const driverProfile = user.driverProfile || null;
    const { session, accessToken, refreshToken } = await sessionService.createSession(
      {
        user,
        driverProfile,
        deviceId,
        deviceType: deviceContext.deviceType,
        platform,
        appVersion,
        ipAddress: requestIp,
        userAgent: deviceContext.userAgent
      },
      transaction
    );

    await createOtpAuditLog(
      {
        phone: normalizedPhone.e164,
        ip: requestIp,
        device: deviceId,
        status: 'otp_verify_success'
      },
      transaction
    );

    await otpRepository.expireSession(otpSession, transaction);

    return {
      user,
      driverProfile,
      session,
      accessToken,
      refreshToken
    };
  });

  await cacheService.setCachedSession(result.session);
  await userRepository.invalidateAuthUserCache(result.user.id);

  return buildAuthPayload(result);
};

const refreshSession = async ({ refreshToken, ipAddress, userAgent }) => {
  const decodedRefreshToken = tokenService.verifyRefreshToken(refreshToken);
  const session = await sessionService.getSessionByIdOrFail(decodedRefreshToken.sid, decodedRefreshToken.sub);

  if (session.revokedAt || session.reuseDetectedAt || new Date(session.expiresAt) <= new Date()) {
    throw new ApiError(401, 'Refresh session is invalid or expired');
  }

  if (session.refreshTokenHash !== hashToken(refreshToken)) {
    await sessionService.handleRefreshTokenReuse({
      sessionId: session.id,
      userId: session.userId,
      ipAddress: ipAddress || session.ipAddress,
      userAgent: userAgent || session.userAgent
    });
    throw new ApiError(401, 'Refresh token reuse detected. Please sign in again.');
  }

  const user = await userRepository.findAuthUserById(decodedRefreshToken.sub);
  if (!user) {
    await sessionService.revokeSession(session.id, 'user_not_found');
    throw new ApiError(401, 'User not found for refresh token');
  }

  const driverProfile = user.driverProfile || null;
  const accessToken = tokenService.issueAccessToken({
    user,
    driverProfile,
    sessionId: session.id
  });
  const rotatedRefreshToken = tokenService.issueRefreshToken({
    user,
    sessionId: session.id
  });

  const updatedSession = await sessionService.rotateRefreshToken({
    sessionId: session.id,
    refreshToken: rotatedRefreshToken,
    ipAddress: ipAddress || session.ipAddress,
    userAgent: userAgent || session.userAgent
  });

  return buildAuthPayload({
    user,
    driverProfile,
    session: updatedSession,
    accessToken,
    refreshToken: rotatedRefreshToken
  });
};

const logoutSession = async ({ userId, sessionId, tokenId, expiresAt }) => {
  await sessionService.getActiveSessionOrFail(sessionId, userId);
  await sessionService.revokeSession(sessionId, 'manual_logout');
  await cacheService.blacklistAccessToken(tokenId, expiresAt);
};

const logoutAllSessions = async ({ userId, tokenId, expiresAt }) => {
  await sessionService.revokeAllSessionsForUser(userId, 'logout_all');
  await cacheService.blacklistAccessToken(tokenId, expiresAt);
};

module.exports = {
  prepareOtpSession,
  verifyOtpAndLogin,
  refreshSession,
  logoutSession,
  logoutAllSessions
};
