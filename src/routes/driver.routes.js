const express = require('express');
const path = require('path');

const driverController = require('../controllers/driver.controller');
const { authenticate, authorizeRoles } = require('../middleware/auth.middleware');
const { upload, uploadRoot } = require('../middleware/upload.middleware');
const validateSchema = require('../middleware/validate.middleware');
const driverSchemas = require('../validators/driver.validator');

const router = express.Router();

router.use(authenticate, authorizeRoles('driver'));
router.get('/profile', driverController.getProfile);
router.post(
  '/kyc',
  upload.fields([
    { name: 'licenseImage', maxCount: 1 },
    { name: 'rcImage', maxCount: 1 },
    { name: 'profilePhoto', maxCount: 1 }
  ]),
  (req, res, next) => {
    const toPublicUrl = (file) => {
      if (!file?.path) {
        return null;
      }

      const relativePath = path.relative(uploadRoot, file.path).replace(/\\/g, '/');
      return `${req.protocol}://${req.get('host')}/uploads/${relativePath}`;
    };

    req.driverKycFiles = {
      licenseImageUrl: toPublicUrl(req.files?.licenseImage?.[0]),
      rcImageUrl: toPublicUrl(req.files?.rcImage?.[0]),
      profilePhotoUrl: toPublicUrl(req.files?.profilePhoto?.[0])
    };
    return next();
  },
  validateSchema(driverSchemas.submitKyc),
  driverController.submitKyc
);
router.post('/online', validateSchema(driverSchemas.setOnlineStatus), driverController.setOnlineStatus);
router.get('/rides/available', driverController.getPendingRideRequests);
router.get('/rides/pending', driverController.getPendingRideRequests);
router.get('/rides/active', driverController.getActiveRide);
router.post('/rides/accept/:id', validateSchema(driverSchemas.acceptRide), driverController.acceptRide);
router.post('/rides/reject/:id', validateSchema(driverSchemas.rideIdParam), driverController.rejectRide);
router.patch('/rides/status/:id', validateSchema(driverSchemas.updateRideStatus), driverController.updateRideStatus);
router.post('/rides/:id/arrived', validateSchema(driverSchemas.rideIdParam), driverController.markArrived);
router.patch(
  '/rides/:id/driver-location',
  validateSchema(driverSchemas.updateDriverLocation),
  driverController.updateDriverLocation
);
router.post('/rides/:id/verify-otp', validateSchema(driverSchemas.verifyRideOtp), driverController.verifyRideOtp);
router.post('/rides/start/:id', validateSchema(driverSchemas.verifyRideOtp), driverController.verifyRideOtp);
router.post('/rides/end/:id', validateSchema(driverSchemas.rideIdParam), driverController.endRide);

module.exports = router;
