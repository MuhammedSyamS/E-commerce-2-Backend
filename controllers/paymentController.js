const Razorpay = require('razorpay');
const crypto = require('crypto');
const Order = require('../models/Order');
const orderController = require('./orderController');

// Initialize Razorpay
// USE ENV VARS IN REAL APP
// For Dev, using Test Keys (Replace with user's keys if provided, or these placeholders)
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'secret_placeholder'
});

// @desc    Create Razorpay Order
// @route   POST /api/payments/create-order
// @access  Private
const createPaymentOrder = async (req, res) => {
    try {
        const { amount, currency = 'INR' } = req.body;

        // DEV MOCK: Only if keys are missing
        console.log("RAZORPAY DEBUG: Key ID present?", !!process.env.RAZORPAY_KEY_ID);
        if (process.env.RAZORPAY_KEY_ID) console.log("RAZORPAY DEBUG: Key Starts With:", process.env.RAZORPAY_KEY_ID.substring(0, 8));

        if (!process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID === 'rzp_test_placeholder') {
            console.log("⚠️ USING MOCK PAYMENT ORDER (Dev Mode)");
            return res.json({
                id: `order_mock_${Date.now()}`,
                currency,
                amount: amount * 100,
                status: 'created'
            });
        }

        const options = {
            amount: amount * 100, // Razorpay works in smallest currency unit (paise)
            currency,
            receipt: `receipt_${Date.now()}`
        };

        const order = await razorpay.orders.create(options);
        res.json(order);

    } catch (error) {
        console.error("Razorpay Create Error:", error);
        res.status(500).json({ message: "Payment initiation failed", error: error.message });
    }
};

// @desc    Get Razorpay Key ID
// @route   GET /api/payments/key
// @access  Public
const getRazorpayKey = async (req, res) => {
    res.json({ key: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder' });
};

// @desc    Verify Payment Signature & Update Order
// @route   POST /api/payments/verify
// @access  Private
const verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

        // MOCK VERIFICATION LOGIC
        if (razorpay_order_id.startsWith('order_mock_')) {
            console.log("⚠️ VERIFYING MOCK PAYMENT");
            // Skip crypto check, just ensure payment_id exists
            if (!razorpay_payment_id) return res.status(400).json({ message: "Invalid Mock Payment" });
        } else {
            // REAL RAZORPAY VERIFICATION
            const body = razorpay_order_id + "|" + razorpay_payment_id;
            const expectedSignature = crypto
                .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'secret_placeholder')
                .update(body.toString())
                .digest('hex');

            if (expectedSignature !== razorpay_signature) {
                return res.status(400).json({ message: "Invalid Payment Signature" });
            }
        }

        // 2. Update Local Order
        const order = await Order.findById(orderId);
        if (order) {
            order.isPaid = true;
            order.paidAt = Date.now();
            order.paymentResult = {
                id: razorpay_payment_id,
                status: 'COMPLETED',
                update_time: Date.now(),
                email_address: req.user.email
            };
            await order.save();
            res.json({ message: "Payment Verified", orderId: order._id });
        } else {
            res.status(404).json({ message: "Order not found" });
        }

    } catch (error) {
        console.error("Razorpay Verify Error:", error);
        res.status(500).json({ message: "Payment verification failed" });
    }
};

module.exports = { createPaymentOrder, verifyPayment, getRazorpayKey };
