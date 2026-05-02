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
router.get('/rides/available', driverController.getAvailableRides);
router.post('/rides/accept/:id', validateSchema(driverSchemas.rideIdParam), driverController.acceptRide);
router.post('/rides/start/:id', validateSchema(driverSchemas.startRide), driverController.startRide);
router.post('/rides/end/:id', validateSchema(driverSchemas.rideIdParam), driverController.endRide);

module.exports = router;
