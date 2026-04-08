const { AuthSession, Op } = require('../models');

const activeSessionWhere = () => ({
  revokedAt: null,
  expiresAt: {
    [Op.gt]: new Date()
  }
});

const createSession = (payload, transaction) =>
  AuthSession.create(payload, {
    transaction
  });

const findById = (id, transaction) =>
  AuthSession.findByPk(id, {
    transaction
  });

const findActiveById = (id, transaction) =>
  AuthSession.findOne({
    where: {
      id,
      ...activeSessionWhere()
    },
    transaction
  });

const findActiveByUserId = (userId, options = {}) =>
  AuthSession.findAll({
    where: {
      userId,
      ...activeSessionWhere()
    },
    order: options.order || [['lastUsedAt', 'DESC']],
    limit: options.limit,
    transaction: options.transaction
  });

const countActiveByUserId = (userId, transaction) =>
  AuthSession.count({
    where: {
      userId,
      ...activeSessionWhere()
    },
    transaction
  });

const updateSession = async (session, payload, transaction) => {
  await session.update(payload, { transaction });
  return session;
};

const revokeSessionById = (id, revokedAt = new Date(), reason = 'manual_logout', transaction) =>
  AuthSession.update(
    {
      revokedAt,
      invalidatedReason: reason
    },
    {
      where: {
        id,
        revokedAt: null
      },
      transaction
    }
  );

const revokeSessionsByIds = (ids, revokedAt = new Date(), reason = 'manual_logout', transaction) => {
  if (!Array.isArray(ids) || ids.length === 0) {
    return Promise.resolve([0]);
  }

  return AuthSession.update(
    {
      revokedAt,
      invalidatedReason: reason
    },
    {
      where: {
        id: {
          [Op.in]: ids
        },
        revokedAt: null
      },
      transaction
    }
  );
};

const revokeAllByUserId = (userId, revokedAt = new Date(), reason = 'manual_logout', transaction) =>
  AuthSession.update(
    {
      revokedAt,
      invalidatedReason: reason
    },
    {
      where: {
        userId,
        revokedAt: null
      },
      transaction
    }
  );

const markRefreshReuseDetected = (id, reuseDetectedAt = new Date(), transaction) =>
  AuthSession.update(
    {
      reuseDetectedAt,
      revokedAt: reuseDetectedAt,
      invalidatedReason: 'refresh_token_reuse'
    },
    {
      where: {
        id
      },
      transaction
    }
  );

const findSessionsForCleanup = ({ now = new Date(), revokedBefore, limit = 500 }) =>
  AuthSession.findAll({
    where: {
      [Op.or]: [
        {
          expiresAt: {
            [Op.lte]: now
          }
        },
        {
          revokedAt: {
            [Op.ne]: null,
            [Op.lte]: revokedBefore
          }
        }
      ]
    },
    order: [['createdAt', 'ASC']],
    limit
  });

const deleteSessionsByIds = (ids, transaction) => {
  if (!Array.isArray(ids) || ids.length === 0) {
    return Promise.resolve(0);
  }

  return AuthSession.destroy({
    where: {
      id: {
        [Op.in]: ids
      }
    },
    transaction
  });
};

module.exports = {
  createSession,
  findById,
  findActiveById,
  findActiveByUserId,
  countActiveByUserId,
  updateSession,
  revokeSessionById,
  revokeSessionsByIds,
  revokeAllByUserId,
  markRefreshReuseDetected,
  findSessionsForCleanup,
  deleteSessionsByIds
};
