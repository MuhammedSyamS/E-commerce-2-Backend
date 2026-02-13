const express = require('express');
const router = express.Router();
const { createPaymentOrder, verifyPayment, getRazorpayKey } = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

router.get('/key', getRazorpayKey); // Public is fine, logic inside handles it
router.post('/create-order', protect, createPaymentOrder);
router.post('/verify', protect, verifyPayment);

module.exports = router;
