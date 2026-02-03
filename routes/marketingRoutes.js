const express = require('express');
const router = express.Router();
const Coupon = require('../models/Coupon');
const Product = require('../models/Product');
const { protect, admin } = require('../middleware/authMiddleware');

// @desc    Verify Coupon
// @route   POST /api/marketing/verify-coupon
// @access  Public
router.post('/verify-coupon', async (req, res) => {
    const { code, cartTotal } = req.body;
    try {
        const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });

        if (!coupon) {
            return res.status(404).json({ message: 'Invalid Coupon Code' });
        }

        if (new Date() > new Date(coupon.expiryDate)) {
            return res.status(400).json({ message: 'Coupon Expired' });
        }

        if (cartTotal < coupon.minPurchase) {
            return res.status(400).json({ message: `Minimum purchase of ₹${coupon.minPurchase} required` });
        }

        let discount = 0;
        if (coupon.discountType === 'percentage') {
            discount = (cartTotal * coupon.discountAmount) / 100;
        } else {
            discount = coupon.discountAmount;
        }

        // Max discount cap? For now, unlimited.
        if (discount > cartTotal) discount = cartTotal;

        res.json({
            discount,
            code: coupon.code,
            message: 'Coupon Applied!'
        });

    } catch (error) {
        res.status(500).json({ message: 'Coupon verification failed' });
    }
});

// ADMIN ROUTES

// @desc    Get All Coupons
// @route   GET /api/marketing/coupons
// @access  Private/Admin
router.get('/coupons', protect, admin, async (req, res) => {
    const coupons = await Coupon.find({}).sort({ createdAt: -1 });
    res.json(coupons);
});

// @desc    Create Coupon
// @route   POST /api/marketing/coupons
// @access  Private/Admin
router.post('/coupons', protect, admin, async (req, res) => {
    try {
        const { code, discountType, discountAmount, minPurchase, expiryDate } = req.body;
        const coupon = await Coupon.create({
            code,
            discountType,
            discountAmount,
            minPurchase,
            expiryDate
        });
        res.status(201).json(coupon);
    } catch (error) {
        res.status(400).json({ message: 'Coupon creation failed' });
    }
});

// @desc    Delete Coupon
// @route   DELETE /api/marketing/coupons/:id
// @access  Private/Admin
router.delete('/coupons/:id', protect, admin, async (req, res) => {
    try {
        await Coupon.findByIdAndDelete(req.params.id);
        res.json({ message: 'Coupon deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Delete failed' });
    }
});

module.exports = router;
