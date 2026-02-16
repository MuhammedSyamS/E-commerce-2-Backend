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
    checkProductFlashSale,
    getBroadcasts,
    createBroadcast,
    toggleCouponStatus,
    toggleFlashSaleStatus
} = require('../controllers/marketingController');

// --- COUPONS ---
router.post('/verify-coupon', verifyCoupon);
router.get('/coupons', protect, admin, getCoupons);
router.post('/coupons', protect, admin, createCoupon);
router.put('/coupons/:id/toggle', protect, admin, toggleCouponStatus);
router.delete('/coupons/:id', protect, admin, deleteCoupon);

// --- NEWSLETTER ---
router.post('/subscribe', subscribeNewsletter);

// --- BROADCASTS ---
router.get('/broadcasts', protect, admin, getBroadcasts);
router.post('/broadcasts', protect, admin, createBroadcast);

// --- FLASH SALES ---
router.get('/flash-sale', getActiveFlashSale); // Public
router.get('/flash-sales', protect, admin, getAllFlashSales);
router.post('/flash-sales', protect, admin, createFlashSale);
router.put('/flash-sales/:id/toggle', protect, admin, toggleFlashSaleStatus);
router.delete('/flash-sales/:id', protect, admin, deleteFlashSale);
router.get('/check-flash/:productId', checkProductFlashSale);

module.exports = router;
