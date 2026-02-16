const mongoose = require('mongoose');
const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const verifyRedemption = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB");

        // 1. SETUP USER
        const testEmail = "redemption_tester@test.com";
        await User.deleteMany({ email: testEmail });

        const user = await User.create({
            firstName: "Loyalty",
            lastName: "Tester",
            email: testEmail,
            password: "password123",
            loyaltyPoints: 500 // Start with 500 points
        });
        console.log(`[PASS] User Created with 500 Points`);

        // 2. CREATE DUMMY PRODUCT
        const product = await Product.findOne({});
        if (!product) throw new Error("No products found");

        // 3. SIMULATE ORDER (As Frontend currently does - INCORRECTLY)
        // Frontend sends: totalPrice = 900 (1000 - 100), pointsToRedeem = 100
        // Expected Backend Result: 800 (Double Deduction)

        // Let's verify if backend subtracts from the received totalPrice
        const mockReqBody = {
            orderItems: [{
                name: product.name,
                qty: 1,
                image: product.image,
                price: 1000,
                product: product._id
            }],
            shippingAddress: { address: "Test", city: "Test", postalCode: "123", country: "IN", phone: "123" },
            paymentMethod: "COD",
            totalPrice: 900, // Frontend sends discounted price
            pointsToRedeem: 100
        };

        // We can't call controller directly without req/res mock.
        // But we can reproduce the logic:
        let finalTotalPrice = mockReqBody.totalPrice; // 900
        if (mockReqBody.pointsToRedeem > 0) {
            // Backend Logic
            finalTotalPrice -= mockReqBody.pointsToRedeem; // 900 - 100 = 800
        }

        console.log(`Frontend sent: ${mockReqBody.totalPrice}`);
        console.log(`Points to redeem: ${mockReqBody.pointsToRedeem}`);
        console.log(`Calculated Final Price (Backend Logic): ${finalTotalPrice}`);

        if (finalTotalPrice === 800) {
            console.error(`[FAIL] Backend double-deducted! Order total became 800 instead of 900.`);
        }

    } catch (error) {
        console.error("Verification Failed:", error);
    } finally {
        await mongoose.disconnect();
    }
};

verifyRedemption();
