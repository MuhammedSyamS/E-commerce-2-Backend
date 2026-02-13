const express = require('express');
const router = express.Router();
const { getSalesReport, getUserGrowthReport } = require('../controllers/reportController');
const { protect, admin } = require('../middleware/authMiddleware');

router.get('/sales', protect, admin, getSalesReport);
router.get('/users', protect, admin, getUserGrowthReport);
router.get('/top-cart', protect, admin, require('../controllers/reportController').getTopCartProducts);

module.exports = router;
