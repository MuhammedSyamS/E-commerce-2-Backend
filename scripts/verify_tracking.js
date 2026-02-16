const axios = require('axios');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const User = require('../models/User');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const verifyTracking = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB");

        // 1. GET RECENT ORDER
        const order = await Order.findOne({}).populate('user');
        if (!order) throw new Error("No orders found");

        const orderId = order._id.toString();
        const email = order.user.email;
        const invalidEmail = "fake@test.com";

        console.log(`Testing Order ID: ${orderId}`);
        console.log(`Valid Email: ${email}`);

        // 2. TEST SUCCESS CASE
        try {
            const res = await axios.post('http://localhost:5005/api/orders/track', {
                orderId,
                email
            });
            console.log(`[PASS] Valid Tracking: Retrieved Order Status: ${res.data.status}`);
        } catch (err) {
            console.error(`[FAIL] Valid Tracking Failed:`, err.response?.data || err.toJSON ? err.toJSON() : err);
        }

        // 3. TEST INVALID EMAIL
        try {
            await axios.post('http://localhost:5005/api/orders/track', {
                orderId,
                email: invalidEmail
            });
            console.error(`[FAIL] Invalid Email should have failed!`);
        } catch (err) {
            if (err.response?.status === 401) {
                console.log(`[PASS] Invalid Email correctly rejected (401)`);
            } else {
                console.error(`[FAIL] Unexpected error for invalid email:`, err.message);
            }
        }

    } catch (error) {
        console.error("Verification Failed:", error);
    } finally {
        await mongoose.disconnect();
    }
};

verifyTracking();
