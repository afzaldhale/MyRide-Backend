const jwt = require('jsonwebtoken');

const env = require('../config/env');
const adminService = require('../services/admin.service');
const ApiError = require('../utils/apiError');
const { sendSuccess } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

const loginAdmin = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    throw new ApiError(400, 'Email and password are required');
  }

  if (email !== env.admin.email || password !== env.admin.password) {
    throw new ApiError(401, 'Invalid admin credentials');
  }

  const token = jwt.sign(
    {
      sub: 'admin',
      role: 'admin',
      type: 'admin'
    },
    env.jwt.secret,
    {
      expiresIn: env.admin.tokenExpiresIn,
      algorithm: env.jwt.algorithm
    }
  );

  return sendSuccess(res, {
    message: 'Admin login successful',
    data: {
      token,
      user: {
        id: 'admin',
        name: env.admin.name,
        email: env.admin.email,
        role: 'admin'
      }
    }
  });
});

const getDashboard = asyncHandler(async (req, res) => {
  const data = await adminService.getDashboardSummary();

  return sendSuccess(res, {
    message: 'Admin dashboard fetched successfully',
    data
  });
});

const getUsers = asyncHandler(async (req, res) => {
  const data = await adminService.getUsers();

  return sendSuccess(res, {
    message: 'Users fetched successfully',
    data
  });
});

const getDrivers = asyncHandler(async (req, res) => {
  const data = await adminService.getDrivers();

  return sendSuccess(res, {
    message: 'Drivers fetched successfully',
    data
  });
});

const getRides = asyncHandler(async (req, res) => {
  const data = await adminService.getRides();

  return sendSuccess(res, {
    message: 'Rides fetched successfully',
    data
  });
});

module.exports = {
  loginAdmin,
  getDashboard,
  getUsers,
  getDrivers,
  getRides
};
