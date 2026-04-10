const express = require('express');

const adminController = require('../controllers/admin.controller');
const { authenticateAdmin } = require('../middleware/adminAuth.middleware');

const router = express.Router();

router.post('/login', adminController.loginAdmin);
router.post('/auth/login', adminController.loginAdmin);

router.use(authenticateAdmin);
router.get('/dashboard', adminController.getDashboard);
router.get('/users', adminController.getUsers);
router.get('/drivers', adminController.getDrivers);
router.get('/rides', adminController.getRides);

module.exports = router;
