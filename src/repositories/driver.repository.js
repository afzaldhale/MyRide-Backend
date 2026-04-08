const { Driver, User, Subscription } = require('../models');
const { KYC_STATUSES } = require('../utils/constants');

const createDriverProfile = (payload, transaction) =>
  Driver.create(payload, {
    transaction
  });

const findByUserId = (userId, transaction) =>
  Driver.findOne({
    where: { userId },
    include: [
      {
        model: User,
        as: 'user'
      },
      {
        model: Subscription,
        as: 'subscriptions'
      }
    ],
    transaction
  });

const findById = (id, transaction) =>
  Driver.findByPk(id, {
    include: [
      {
        model: User,
        as: 'user'
      }
    ],
    transaction
  });

const findActiveApprovedDrivers = () =>
  Driver.findAll({
    where: {
      isOnline: true,
      kycStatus: KYC_STATUSES.APPROVED
    },
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'phoneNumber', 'name']
      }
    ]
  });

const updateDriverProfile = async (driver, payload, transaction) => {
  await driver.update(payload, { transaction });
  return driver;
};

module.exports = {
  createDriverProfile,
  findByUserId,
  findById,
  findActiveApprovedDrivers,
  updateDriverProfile
};
