const rideService = require('../services/ride.service');
const { sendSuccess } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

const requestRide = asyncHandler(async (req, res) => {
  const ride = await rideService.requestRide(req.user, req.body);

  return sendSuccess(res, {
    statusCode: 201,
    message: 'Ride requested successfully',
    data: ride
  });
});

const getMyRides = asyncHandler(async (req, res) => {
  const rides = await rideService.getMyRides(req.user);

  return sendSuccess(res, {
    message: 'Rides fetched successfully',
    data: rides
  });
});

const getActiveRide = asyncHandler(async (req, res) => {
  const ride = await rideService.getActiveRide(req.user);

  return sendSuccess(res, {
    message: ride ? 'Active ride fetched successfully' : 'No active ride found',
    data: ride
  });
});

const cancelRide = asyncHandler(async (req, res) => {
  const ride = await rideService.cancelRide(req.user, req.params.id);

  return sendSuccess(res, {
    message: 'Ride cancelled successfully',
    data: ride
  });
});

module.exports = {
  requestRide,
  getMyRides,
  getActiveRide,
  cancelRide
};
