const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const {
    verifyCoupon,
    getCoupons,
    createCoupon,
    deleteCoupon,
    subscribeNewsletter,
    getActiveFlashSale,
    getAllFlashSales,
    createFlashSale,
    deleteFlashSale,
    checkProductFlashSale
} = require('../controllers/marketingController');

// --- COUPONS ---
router.post('/verify-coupon', verifyCoupon);
router.get('/coupons', protect, admin, getCoupons);
router.post('/coupons', protect, admin, createCoupon);
router.delete('/coupons/:id', protect, admin, deleteCoupon);

// --- NEWSLETTER ---
router.post('/subscribe', subscribeNewsletter);

// --- FLASH SALES ---
router.get('/flash-sale', getActiveFlashSale); // Public
router.get('/flash-sales', protect, admin, getAllFlashSales);
router.post('/flash-sales', protect, admin, createFlashSale);
router.delete('/flash-sales/:id', protect, admin, deleteFlashSale);
router.get('/check-flash/:productId', checkProductFlashSale);

module.exports = router;
