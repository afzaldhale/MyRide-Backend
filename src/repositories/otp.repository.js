const { Op, OtpAttempt, OtpLog, OtpSession } = require('../models');

const countAttemptsSince = ({ where }) => OtpAttempt.count({ where });

const createAttempt = (payload, transaction) =>
  OtpAttempt.create(payload, {
    transaction
  });

const createLog = (payload, transaction) =>
  OtpLog.create(payload, {
    transaction
  });

const createSession = (payload, transaction) =>
  OtpSession.create(payload, {
    transaction
  });

const findActiveSession = ({ phoneNumber, deviceId }) =>
  OtpSession.findOne({
    where: {
      phoneNumber,
      deviceId,
      expiresAt: {
        [Op.gt]: new Date()
      }
    },
    order: [['createdAt', 'DESC']]
  });

const incrementSessionAttemptCount = async (session, transaction) => {
  session.attemptCount += 1;
  await session.save({ transaction });
  return session;
};

const expireSession = async (session, transaction) => {
  session.expiresAt = new Date();
  await session.save({ transaction });
  return session;
};

const expireExistingSessions = ({ phoneNumber, deviceId }, transaction) =>
  OtpSession.update(
    {
      expiresAt: new Date()
    },
    {
      where: {
        phoneNumber,
        deviceId,
        expiresAt: {
          [Op.gt]: new Date()
        }
      },
      transaction
    }
  );

module.exports = {
  countAttemptsSince,
  createAttempt,
  createLog,
  createSession,
  findActiveSession,
  incrementSessionAttemptCount,
  expireSession,
  expireExistingSessions,
  Op
};
