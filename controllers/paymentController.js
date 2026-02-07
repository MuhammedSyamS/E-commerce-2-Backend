const Razorpay = require('razorpay');
const crypto = require('crypto');
const Order = require('../models/Order');

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

        // DEV MOCK: If using placeholders, return fake order
        if (process.env.RAZORPAY_KEY_ID === 'rzp_test_placeholder' || !process.env.RAZORPAY_KEY_ID) {
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

// @desc    Verify Payment Signature & Update Order
// @route   POST /api/payments/verify
// @access  Private
const verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

        // 1. Verify Signature
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'secret_placeholder')
            .update(body.toString())
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({ message: "Invalid Payment Signature" });
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

module.exports = { createPaymentOrder, verifyPayment };
