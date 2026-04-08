const express = require('express');

const driverController = require('../controllers/driver.controller');
const { authenticate, authorizeRoles } = require('../middleware/auth.middleware');
const validateSchema = require('../middleware/validate.middleware');
const driverSchemas = require('../validators/driver.validator');

const router = express.Router();

router.use(authenticate, authorizeRoles('driver'));
router.post('/kyc', validateSchema(driverSchemas.submitKyc), driverController.submitKyc);
router.post('/online', validateSchema(driverSchemas.setOnlineStatus), driverController.setOnlineStatus);
router.get('/rides/available', driverController.getAvailableRides);
router.post('/rides/accept/:id', validateSchema(driverSchemas.rideIdParam), driverController.acceptRide);
router.post('/rides/start/:id', validateSchema(driverSchemas.startRide), driverController.startRide);
router.post('/rides/end/:id', validateSchema(driverSchemas.rideIdParam), driverController.endRide);

module.exports = router;
