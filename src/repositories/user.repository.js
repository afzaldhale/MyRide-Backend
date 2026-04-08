const { User, Driver } = require('../models');
const cacheService = require('../services/cache.service');

const toCachedUserShape = (user) => {
  if (!user) {
    return null;
  }

  const plain = typeof user.get === 'function' ? user.get({ plain: true }) : user;

  return {
    id: plain.id,
    phoneNumber: plain.phoneNumber,
    role: plain.role,
    name: plain.name,
    profilePhoto: plain.profilePhoto,
    createdAt: plain.createdAt,
    driverProfile: plain.driverProfile || null
  };
};

const findByPhoneNumber = (phoneNumber, transaction) =>
  User.findOne({
    where: { phoneNumber },
    include: [
      {
        model: Driver,
        as: 'driverProfile'
      }
    ],
    transaction
  });

const findById = (id) =>
  User.findByPk(id, {
    include: [
      {
        model: Driver,
        as: 'driverProfile'
      }
    ]
  });

const findAuthUserById = async (id) => {
  const cachedUser = await cacheService.getCachedAuthUser(id);
  if (cachedUser) {
    return cachedUser;
  }

  const user = await findById(id);
  if (!user) {
    return null;
  }

  const serialized = toCachedUserShape(user);
  await cacheService.setCachedAuthUser(serialized);
  return serialized;
};

const invalidateAuthUserCache = (id) => cacheService.invalidateAuthUserCache(id);

const createUser = async (payload, transaction) => {
  const user = await User.create(payload, {
    transaction
  });

  await invalidateAuthUserCache(user.id);
  return user;
};

module.exports = {
  findByPhoneNumber,
  findById,
  findAuthUserById,
  invalidateAuthUserCache,
  createUser
};
