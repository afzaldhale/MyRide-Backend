
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const adminService = require('../services/admin.service');
const ApiError = require('../utils/apiError');
const { sendSuccess } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const realtimeGateway = require('../services/realtimeGateway.service');
const logger = require('../utils/logger');
const { KYC_STATUSES } = require('../utils/constants');

// PATCH /api/admin/drivers/:id/kyc
const updateDriverKyc = asyncHandler(async (req, res) => {
  const adminId = req.admin?.payload?.sub || 'unknown';
  const { id } = req.params;
  const { status, rejectionReason } = req.body;

  // Validate status
  if (!['approved', 'rejected'].includes(status)) {
    throw new ApiError(422, 'Invalid status');
  }

  // Find driver
  const driver = await adminService.findDriverById(id);
  if (!driver) {
    throw new ApiError(404, 'Driver not found');
  }

  // Update driver KYC
  const updatedDriver = await adminService.updateDriverKyc({
    driverId: id,
    status,
    rejectionReason,
    adminId
  });

  // Emit socket event
  if (realtimeGateway.emit) {
    realtimeGateway.emit('driver:kyc:updated', {
      driverId: updatedDriver.id,
      isApproved: updatedDriver.is_approved
    });
  }

  // Log action
  logger.info('Admin KYC action', {
    adminId,
    driverId: id,
    action: status
  });

  return sendSuccess(res, {
    message: 'Driver KYC updated successfully',
    data: updatedDriver
  });
});

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

const approveDriver = asyncHandler(async (req, res) => {
  const data = await adminService.approveDriver(req.params.id);

  return sendSuccess(res, {
    message: 'Driver approved successfully',
    data
  });
});

module.exports = {
  loginAdmin,
  getDashboard,
  getUsers,
  getDrivers,
  getRides,
  approveDriver
  ,updateDriverKyc
};
