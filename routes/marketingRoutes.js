const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const {
    verifyCoupon,
    getCoupons,
    createCoupon,
    deleteCoupon,
    updateCoupon,
    subscribeNewsletter,
    getActiveFlashSale,
    getAllFlashSales,
    createFlashSale,
    deleteFlashSale,
    updateFlashSale,
    checkProductFlashSale,
    getBroadcasts,
    createBroadcast,
    toggleCouponStatus,
    toggleFlashSaleStatus
} = require('../controllers/marketingController');

const asyncHandler = require('../middleware/asyncHandler');

// --- COUPONS ---
router.post('/verify-coupon', asyncHandler(verifyCoupon));
router.get('/coupons', protect, admin, asyncHandler(getCoupons));
router.post('/coupons', protect, admin, asyncHandler(createCoupon));
router.put('/coupons/:id/toggle', protect, admin, asyncHandler(toggleCouponStatus));
router.put('/coupons/:id', protect, admin, asyncHandler(updateCoupon));
router.delete('/coupons/:id', protect, admin, asyncHandler(deleteCoupon));

// --- NEWSLETTER ---
router.post('/subscribe', asyncHandler(subscribeNewsletter));

// --- BROADCASTS ---
router.get('/broadcasts', protect, admin, asyncHandler(getBroadcasts));
router.post('/broadcasts', protect, admin, asyncHandler(createBroadcast));

// --- FLASH SALES ---
router.get('/flash-sale', asyncHandler(getActiveFlashSale)); // Public
router.get('/flash-sales', protect, admin, asyncHandler(getAllFlashSales));
router.post('/flash-sales', protect, admin, asyncHandler(createFlashSale));
router.put('/flash-sales/:id/toggle', protect, admin, asyncHandler(toggleFlashSaleStatus));
router.put('/flash-sales/:id', protect, admin, asyncHandler(updateFlashSale));
router.delete('/flash-sales/:id', protect, admin, asyncHandler(deleteFlashSale));
router.get('/check-flash/:productId', asyncHandler(checkProductFlashSale));

module.exports = router;
