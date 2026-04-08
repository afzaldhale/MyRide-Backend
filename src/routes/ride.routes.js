const express = require('express');

const rideController = require('../controllers/ride.controller');
const { authenticate, authorizeRoles } = require('../middleware/auth.middleware');
const validateSchema = require('../middleware/validate.middleware');
const rideSchemas = require('../validators/ride.validator');

const router = express.Router();

router.use(authenticate, authorizeRoles('rider'));
router.post('/request', validateSchema(rideSchemas.requestRide), rideController.requestRide);
router.get('/my-rides', rideController.getMyRides);
router.post('/cancel/:id', validateSchema(rideSchemas.rideIdParam), rideController.cancelRide);

module.exports = router;
