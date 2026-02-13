const express = require('express');
const router = express.Router();
const { createCoupon, validateCoupon, getAllCoupons, deleteCoupon } = require('../controllers/couponController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/')
    .post(protect, admin, createCoupon)
    .get(protect, admin, getAllCoupons);

router.post('/validate', protect, validateCoupon); // Protect so only logged in users can use? Or make public if guest checkout allowed. Let's start with protect.

router.route('/:id')
    .delete(protect, admin, deleteCoupon);

module.exports = router;
