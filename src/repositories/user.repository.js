const { User, Driver } = require('../models');
const cacheService = require('../services/cache.service');

const includeDriverProfile = [
  {
    model: Driver,
    as: 'driverProfile'
  }
];

const toCachedUserShape = (user) => {
  if (!user) {
    return null;
  }

  const plain =
    typeof user.get === 'function'
      ? user.get({ plain: true })
      : user;

  return {
    id: plain.id,
    phoneNumber: plain.phoneNumber,
    email: plain.email,
    googleId: plain.googleId,
    role: plain.role,
    name: plain.name,
    profilePhoto: plain.profilePhoto,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
    driverProfile: plain.driverProfile || null
  };
};

const findByPhoneNumber = (phoneNumber, transaction) =>
  User.findOne({
    where: { phoneNumber },
    include: includeDriverProfile,
    transaction
  });

const findByEmail = (email, transaction) =>
  User.findOne({
    where: { email },
    include: includeDriverProfile,
    transaction
  });

const findByGoogleId = (googleId, transaction) =>
  User.findOne({
    where: { googleId },
    include: includeDriverProfile,
    transaction
  });

const findById = (id) =>
  User.findByPk(id, {
    include: includeDriverProfile
  });

const findAuthUserById = async (id) => {
  const cachedUser =
    await cacheService.getCachedAuthUser(id);

  if (cachedUser) {
    return cachedUser;
  }

  const user = await findById(id);

  if (!user) {
    return null;
  }

  const serialized = toCachedUserShape(user);

  await cacheService.setCachedAuthUser(
    serialized
  );

  return serialized;
};

const invalidateAuthUserCache = (id) =>
  cacheService.invalidateAuthUserCache(id);

const createUser = async (
  payload,
  transaction
) => {
  const user = await User.create(payload, {
    transaction
  });

  await invalidateAuthUserCache(user.id);

  return user;
};

const updateUser = async (
  id,
  payload,
  transaction
) => {
  await User.update(payload, {
    where: { id },
    transaction
  });

  await invalidateAuthUserCache(id);

  return findById(id);
};

const updateGoogleUser = async (
  id,
  googleId,
  email,
  profilePhoto,
  transaction
) => {
  await User.update(
    {
      googleId,
      email,
      profilePhoto
    },
    {
      where: { id },
      transaction
    }
  );

  await invalidateAuthUserCache(id);

  return findById(id);
};

module.exports = {
  findByPhoneNumber,
  findByEmail,
  findByGoogleId,
  findById,
  findAuthUserById,
  invalidateAuthUserCache,
  createUser,
  updateUser,
  updateGoogleUser
};