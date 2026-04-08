const { v4: uuidv4 } = require('uuid');

const env = require('../config/env');
const logger = require('../config/logger');
const authSessionRepository = require('../repositories/authSession.repository');
const ApiError = require('../utils/apiError');
const { hashToken } = require('../utils/crypto');
const cacheService = require('./cache.service');
const tokenService = require('./token.service');
const { SESSION_SECURITY_EVENTS } = require('../utils/constants');

const toSessionCacheShape = (session) => ({
  id: session.id,
  userId: session.userId,
  refreshTokenHash: session.refreshTokenHash,
  deviceId: session.deviceId,
  deviceType: session.deviceType,
  platform: session.platform,
  appVersion: session.appVersion,
  ipAddress: session.ipAddress,
  userAgent: session.userAgent,
  lastUsedAt: session.lastUsedAt,
  lastRotatedAt: session.lastRotatedAt,
  expiresAt: session.expiresAt,
  revokedAt: session.revokedAt,
  invalidatedReason: session.invalidatedReason,
  reuseDetectedAt: session.reuseDetectedAt,
  createdAt: session.createdAt
});

const getRefreshTokenExpiryDate = () =>
  new Date(Date.now() + env.refresh.ttlDays * 24 * 60 * 60 * 1000);

const invalidateSessionCaches = (sessionIds) =>
  Promise.all(sessionIds.map((sessionId) => cacheService.invalidateSessionCache(sessionId)));

const enforceMaxActiveSessions = async (userId, transaction) => {
  const activeCount = await authSessionRepository.countActiveByUserId(userId, transaction);
  const overflow = activeCount - env.session.maxActivePerUser + 1;

  if (overflow <= 0) {
    return [];
  }

  const sessionsToRevoke = await authSessionRepository.findActiveByUserId(userId, {
    transaction,
    limit: overflow,
    order: [['lastUsedAt', 'ASC']]
  });

  const sessionIds = sessionsToRevoke.map((session) => session.id);
  await authSessionRepository.revokeSessionsByIds(
    sessionIds,
    new Date(),
    'session_limit_enforced',
    transaction
  );
  await invalidateSessionCaches(sessionIds);

  if (sessionIds.length > 0) {
    logger.warn('Active session limit enforced', {
      event: SESSION_SECURITY_EVENTS.SESSION_LIMIT_ENFORCED,
      userId,
      revokedSessionCount: sessionIds.length,
      maxActiveSessions: env.session.maxActivePerUser
    });
  }

  return sessionIds;
};

const createSession = async (
  { user, driverProfile, deviceId, deviceType, platform, appVersion, ipAddress, userAgent },
  transaction
) => {
  await enforceMaxActiveSessions(user.id, transaction);

  const sessionId = uuidv4();
  const accessToken = tokenService.issueAccessToken({
    user,
    driverProfile,
    sessionId
  });
  const refreshToken = tokenService.issueRefreshToken({
    user,
    sessionId
  });

  const now = new Date();
  const session = await authSessionRepository.createSession(
    {
      id: sessionId,
      userId: user.id,
      refreshTokenHash: hashToken(refreshToken.token),
      deviceId,
      deviceType,
      platform,
      appVersion,
      ipAddress,
      userAgent,
      lastUsedAt: now,
      lastRotatedAt: now,
      expiresAt: getRefreshTokenExpiryDate()
    },
    transaction
  );

  return {
    session: toSessionCacheShape(session),
    accessToken,
    refreshToken
  };
};

const getSessionByIdOrFail = async (sessionId, userId = null, transaction) => {
  let session = await cacheService.getCachedSession(sessionId);

  if (!session) {
    const dbSession = await authSessionRepository.findById(sessionId, transaction);
    if (!dbSession) {
      throw new ApiError(401, 'Session is invalid or expired');
    }

    session = toSessionCacheShape(dbSession);
    await cacheService.setCachedSession(session);
  }

  if (userId && session.userId !== userId) {
    throw new ApiError(403, 'Session does not belong to the authenticated user');
  }

  return session;
};

const getActiveSessionOrFail = async (sessionId, userId = null, transaction) => {
  const session = await getSessionByIdOrFail(sessionId, userId, transaction);

  if (session.revokedAt || session.reuseDetectedAt || new Date(session.expiresAt) <= new Date()) {
    throw new ApiError(401, 'Session is invalid or expired');
  }

  return session;
};

const rotateRefreshToken = async ({ sessionId, refreshToken, ipAddress, userAgent, transaction }) => {
  const dbSession = await authSessionRepository.findById(sessionId, transaction);
  if (!dbSession || dbSession.revokedAt || dbSession.reuseDetectedAt || dbSession.expiresAt <= new Date()) {
    throw new ApiError(401, 'Session is invalid or expired');
  }

  const now = new Date();
  await authSessionRepository.updateSession(
    dbSession,
    {
      refreshTokenHash: hashToken(refreshToken.token),
      lastUsedAt: now,
      lastRotatedAt: now,
      ipAddress,
      userAgent
    },
    transaction
  );

  const serialized = toSessionCacheShape(dbSession);
  await cacheService.setCachedSession(serialized);

  return serialized;
};

const revokeSession = async (sessionId, reason = 'manual_logout', transaction) => {
  await authSessionRepository.revokeSessionById(sessionId, new Date(), reason, transaction);
  await cacheService.invalidateSessionCache(sessionId);
};

const revokeAllSessionsForUser = async (userId, reason = 'manual_logout', transaction) => {
  const sessions = await authSessionRepository.findActiveByUserId(userId, {
    transaction
  });
  await authSessionRepository.revokeAllByUserId(userId, new Date(), reason, transaction);
  await invalidateSessionCaches(sessions.map((session) => session.id));
};

const handleRefreshTokenReuse = async ({ sessionId, userId, ipAddress, userAgent }, transaction) => {
  await authSessionRepository.markRefreshReuseDetected(sessionId, new Date(), transaction);
  await revokeAllSessionsForUser(userId, 'refresh_token_reuse', transaction);

  logger.warn('Refresh token reuse detected', {
    event: SESSION_SECURITY_EVENTS.REFRESH_REUSE_DETECTED,
    sessionId,
    userId,
    ipAddress,
    userAgent
  });
};

const cleanupExpiredSessions = async () => {
  const revokedBefore = new Date(Date.now() - env.session.retentionDays * 24 * 60 * 60 * 1000);
  const staleSessions = await authSessionRepository.findSessionsForCleanup({
    now: new Date(),
    revokedBefore,
    limit: env.session.cleanupBatchSize
  });

  if (staleSessions.length === 0) {
    return {
      deletedCount: 0
    };
  }

  const sessionIds = staleSessions.map((session) => session.id);
  const deletedCount = await authSessionRepository.deleteSessionsByIds(sessionIds);
  await invalidateSessionCaches(sessionIds);

  logger.info('Expired auth sessions cleaned up', {
    deletedCount
  });

  return {
    deletedCount
  };
};

const listActiveSessions = (userId) => authSessionRepository.findActiveByUserId(userId);

module.exports = {
  createSession,
  getSessionByIdOrFail,
  getActiveSessionOrFail,
  rotateRefreshToken,
  revokeSession,
  revokeAllSessionsForUser,
  handleRefreshTokenReuse,
  cleanupExpiredSessions,
  listActiveSessions
};
