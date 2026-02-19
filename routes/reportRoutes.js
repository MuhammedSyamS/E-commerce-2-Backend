const express = require('express');
const router = express.Router();
const {
    getSalesReport,
    getUserGrowthReport,
    getSalesReportPDF,
    getUserGrowthReportPDF,
    getOrderReportPDF
} = require('../controllers/reportController');
const { protect, admin } = require('../middleware/authMiddleware');

router.get('/sales', protect, admin, getSalesReport);
router.get('/sales/pdf', protect, admin, getSalesReportPDF);
router.get('/users', protect, admin, getUserGrowthReport);
router.get('/users/pdf', protect, admin, getUserGrowthReportPDF);
router.get('/orders/pdf', protect, admin, getOrderReportPDF);
router.get('/top-cart', protect, admin, require('../controllers/reportController').getTopCartProducts);

module.exports = router;
