const express = require('express');

const authRoutes = require('./auth.routes');
const rideRoutes = require('./ride.routes');
const driverRoutes = require('./driver.routes');
const adminRoutes = require('./admin.routes');
const systemController = require('../controllers/system.controller');

const router = express.Router();

router.get('/health', systemController.getHealth);
router.use('/auth', authRoutes);
router.use('/rides', rideRoutes);
router.use('/driver', driverRoutes);
router.use('/admin', adminRoutes);

module.exports = router;
