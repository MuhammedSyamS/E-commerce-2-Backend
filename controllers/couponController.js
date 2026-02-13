const Coupon = require('../models/Coupon');

// @desc    Create a Coupon
// @route   POST /api/coupons
// @access  Private/Admin
const createCoupon = async (req, res) => {
    try {
        const { code, discountType, discountAmount, minPurchase, expiryDate } = req.body;

        // Check if exists
        const existing = await Coupon.findOne({ code: code.toUpperCase() });
        if (existing) {
            return res.status(400).json({ message: 'Coupon code already exists' });
        }

        const coupon = new Coupon({
            code,
            discountType,
            discountAmount,
            minPurchase,
            expiryDate
        });

        const createdCoupon = await coupon.save();
        res.status(201).json(createdCoupon);
    } catch (error) {
        res.status(500).json({ message: 'Failed to create coupon', error: error.message });
    }
};

// @desc    Validate Coupon for Checkout
// @route   POST /api/coupons/validate
// @access  Private (User/Guest)
const validateCoupon = async (req, res) => {
    const { code, cartTotal } = req.body;

    try {
        const coupon = await Coupon.findOne({ code: code.toUpperCase() });

        if (!coupon) {
            return res.status(404).json({ message: 'Invalid Coupon Code' });
        }

        if (!coupon.isActive) {
            return res.status(400).json({ message: 'Coupon is inactive' });
        }

        if (new Date(coupon.expiryDate) < Date.now()) {
            return res.status(400).json({ message: 'Coupon has expired' });
        }

        if (cartTotal < coupon.minPurchase) {
            return res.status(400).json({ message: `Minimum purchase of ₹${coupon.minPurchase} required` });
        }

        // Calculate Discount
        let calculatedDiscount = 0;
        if (coupon.discountType === 'percentage') {
            calculatedDiscount = (cartTotal * coupon.discountAmount) / 100;
        } else {
            calculatedDiscount = coupon.discountAmount;
        }

        // Ensure discount doesn't exceed total
        if (calculatedDiscount > cartTotal) calculatedDiscount = cartTotal;

        res.json({
            message: 'Coupon Applied',
            discountAmount: calculatedDiscount,
            finalTotal: cartTotal - calculatedDiscount,
            code: coupon.code
        });

    } catch (error) {
        res.status(500).json({ message: 'Validation failed' });
    }
};

// @desc    Get All Coupons (Admin)
// @route   GET /api/coupons
// @access  Private/Admin
const getAllCoupons = async (req, res) => {
    try {
        const coupons = await Coupon.find({}).sort({ createdAt: -1 });
        res.json(coupons);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch coupons' });
    }
};

// @desc    Delete Coupon
// @route   DELETE /api/coupons/:id
// @access  Private/Admin
const deleteCoupon = async (req, res) => {
    try {
        const coupon = await Coupon.findById(req.params.id);
        if (coupon) {
            await Coupon.deleteOne({ _id: coupon._id });
            res.json({ message: 'Coupon removed' });
        } else {
            res.status(404).json({ message: 'Coupon not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Delete failed' });
    }
};

module.exports = { createCoupon, validateCoupon, getAllCoupons, deleteCoupon };
