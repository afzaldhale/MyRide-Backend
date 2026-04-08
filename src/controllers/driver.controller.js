const driverService = require('../services/driver.service');
const { sendSuccess } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

const submitKyc = asyncHandler(async (req, res) => {
  const driver = await driverService.submitKyc(req.user, req.body);

  return sendSuccess(res, {
    message: 'Driver KYC submitted successfully',
    data: driver
  });
});

const setOnlineStatus = asyncHandler(async (req, res) => {
  const driver = await driverService.setOnlineStatus(req.user, req.body.is_online);

  return sendSuccess(res, {
    message: 'Driver availability updated successfully',
    data: driver
  });
});

const getAvailableRides = asyncHandler(async (req, res) => {
  const rides = await driverService.getAvailableRides(req.user);

  return sendSuccess(res, {
    message: 'Available rides fetched successfully',
    data: rides
  });
});

const acceptRide = asyncHandler(async (req, res) => {
  const ride = await driverService.acceptRide(req.user, req.params.id);

  return sendSuccess(res, {
    message: 'Ride accepted successfully',
    data: ride
  });
});

const startRide = asyncHandler(async (req, res) => {
  const ride = await driverService.startRide(req.user, req.params.id, req.body.ride_otp);

  return sendSuccess(res, {
    message: 'Ride started successfully',
    data: ride
  });
});

const endRide = asyncHandler(async (req, res) => {
  const ride = await driverService.endRide(req.user, req.params.id);

  return sendSuccess(res, {
    message: 'Ride completed successfully',
    data: ride
  });
});

module.exports = {
  submitKyc,
  setOnlineStatus,
  getAvailableRides,
  acceptRide,
  startRide,
  endRide
};
