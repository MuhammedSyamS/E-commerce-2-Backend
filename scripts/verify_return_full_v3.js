const axios = require('axios');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Return = require('../models/Return');

const API_URL = 'http://localhost:5005/api';
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';
const MONGO_URI = process.env.MONGO_URI;

const run = async () => {
    try {
        console.log("🚀 Starting verification V3 (Mongoose Models)...");

        if (!MONGO_URI) throw new Error("MONGO_URI not found");
        await mongoose.connect(MONGO_URI);
        console.log("   ✅ Connected to DB");

        // 1. CREATE USER
        const testUserPayload = {
            firstName: 'Mongoose', lastName: 'Test',
            email: `mongoose.${Date.now()}@test.com`,
            password: 'password123', // Mongoose pre-save will hash this!
            role: 'customer'
        };
        const user = await User.create(testUserPayload);
        console.log(`   ✅ User Created: ${user.email} (${user._id})`);

        // 2. GENERATE TOKEN
        const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '1d' });

        // 3. GET PRODUCT
        const product = await Product.findOne({});
        if (!product) throw new Error("No products found");

        // 4. CREATE DELIVERED ORDER
        // Note: orderItems default to empty array if not array of objects in schema? 
        // Schema defines it as array of subdocs.

        const orderPayload = {
            user: user._id,
            orderItems: [{
                product: product._id,
                name: product.name,
                image: product.image,
                price: product.price,
                qty: 1,
                selectedVariant: product.variants?.[0] || { size: 'M', color: 'Black' }
                // status defaults to 'Ordered'
            }],
            shippingAddress: { address: '123 St', city: 'City', postalCode: '000', phone: '123' },
            paymentMethod: 'COD',
            itemsPrice: product.price,
            totalPrice: product.price,
            isPaid: true,
            isDelivered: true,
            deliveredAt: new Date(),
            orderStatus: 'Delivered'
        };

        const order = await Order.create(orderPayload);
        console.log(`   ✅ Order Created: ${order._id}`);

        // Update item status to 'Delivered' manually since default is 'Ordered'
        // And my create payload didn't specify item status (or maybe schema default overrides).
        // Let's force update to ensure controller check passes.
        order.orderItems[0].status = 'Delivered';
        await order.save();
        console.log("   ✅ Order Item Status set to Delivered");

        // 5. INITIATE RETURN (API)
        console.log("\nTesting POST /api/returns...");

        const itemId = order.orderItems[0]._id; // This is a real ObjectId now
        console.log(`   ℹ️  Item ID: ${itemId}`);

        const returnPayload = {
            orderId: order._id.toString(),
            itemId: itemId.toString(),
            reason: 'Quality Issue',
            comment: 'V3 Test',
            type: 'Return',
            // Adding dummy video link to bypass validation if required?
            // Controller: const hasVideo = images && images.some(...)
            images: ['http://res.cloudinary.com/demo/video/upload/v1/dog.mp4']
        };

        try {
            await axios.post(`${API_URL}/returns`, returnPayload, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log("   ✅ Return Requested Successfully (API)");
        } catch (e) {
            console.error("   ❌ API Failed:", e.response?.data || e.message);
            throw e;
        }

        // 6. APPROVE (Admin Simulation)
        const returnDoc = await Return.findOne({ order: order._id });
        if (!returnDoc) throw new Error("Return Not Found");

        returnDoc.status = 'Approved';
        await returnDoc.save();
        console.log("   ✅ Return Approved (DB)");

        // 7. Success
        console.log("\n🎉 V3 VERIFICATION SUCCESSFUL!");

        await mongoose.disconnect();
        process.exit(0);

    } catch (err) {
        console.error("\n❌ V3 Failed:", err.message);
        if (err.response) console.error("   API Resp:", err.response.data);
        await mongoose.disconnect();
        process.exit(1);
    }
};

run();
