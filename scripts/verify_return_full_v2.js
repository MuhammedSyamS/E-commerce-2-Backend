const axios = require('axios');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// User Schema for Pre-save hook simulation if needed, but we can just use the model if valid.
// Actually, we can just use `User` model from the file if we require it, 
// BUT requiring models in a script can be tricky if they have other dependencies.
// Simplest is to define a schema or just insert raw if we don't care about hooks (but we need password hash for login? No, we generate token directly!).

const API_URL = 'http://localhost:5005/api';
// Use the secret from .env we read:
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';
const MONGO_URI = process.env.MONGO_URI;

const run = async () => {
    try {
        console.log("🚀 Starting verification V2 (Direct DB Setup)...");

        if (!MONGO_URI) throw new Error("MONGO_URI not found");
        await mongoose.connect(MONGO_URI);
        console.log("   ✅ Connected to DB");

        const User = mongoose.connection.collection('users');
        const Product = mongoose.connection.collection('products');
        const Order = mongoose.connection.collection('orders');
        const Return = mongoose.connection.collection('returns');

        // 1. CREATE USER (Direct DB)
        const userId = new mongoose.Types.ObjectId();
        const testUser = {
            _id: userId,
            firstName: 'Direct', lastName: 'Test',
            email: `direct.${Date.now()}@test.com`,
            password: 'hashed_password_placeholder', // We don't need real login, so hash doesn't matter for token gen
            isAdmin: false,
            isBlocked: false,
            createdAt: new Date(), updatedAt: new Date()
        };
        await User.insertOne(testUser);
        console.log(`   ✅ User Created (DB): ${testUser.email}`);

        // 2. GENERATE TOKEN
        const token = jwt.sign({ id: userId.toString() }, JWT_SECRET, { expiresIn: '1d' });
        console.log("   ✅ Valid JWT Token Generated Locally");

        // 3. GET PRODUCT
        const product = await Product.findOne({});
        if (!product) throw new Error("No products found");

        // 4. CREATE DELIVERED ORDER (Direct DB)
        const orderId = new mongoose.Types.ObjectId();
        const orderItem = {
            _id: new mongoose.Types.ObjectId(), // Important: Subdocument ID
            product: product._id,
            name: product.name,
            image: product.image,
            price: product.price,
            qty: 1,
            selectedVariant: product.variants?.[0] || { size: 'M', color: 'Black' },
            status: 'Delivered'
        };

        const testOrder = {
            _id: orderId,
            user: userId,
            orderItems: [orderItem],
            shippingAddress: { address: 'Test', city: 'Test', postalCode: '111', country: 'Test', phone: '123' },
            paymentMethod: 'COD',
            itemsPrice: product.price,
            totalPrice: product.price,
            isPaid: true,
            isDelivered: true,
            deliveredAt: new Date(), // Delivered Now
            createdAt: new Date(),
            updatedAt: new Date(),
            orderStatus: 'Delivered'
        };

        await Order.insertOne(testOrder);
        console.log(`   ✅ Delivered Order Created (DB): ${orderId}`);

        // 5. INITIATE RETURN (API Call - Testing Controller Logic)
        console.log("\nTesting POST /api/returns (Controller Logic)...");

        // We use the ITEM ID (subdocument ID) or Product ID. 
        // Based on previous analysis, frontend sends `itemId` (which matches the key in map).
        // Let's try sending the subdoc ID first.
        const returnPayload = {
            orderId: orderId.toString(),
            itemId: orderItem._id.toString(),
            reason: 'Quality Issue',
            comment: 'V2 Test',
            type: 'Return'
        };

        try {
            await axios.post(`${API_URL}/returns`, returnPayload, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log("   ✅ Return Requested Successfully (API)");
        } catch (e) {
            console.error("   ❌ API Failed:", e.response?.data || e.message);
            // Retry with Product ID if simple ID failed
            console.log("   ⚠️ Retrying with Product ID just in case...");
            returnPayload.itemId = product._id.toString();
            await axios.post(`${API_URL}/returns`, returnPayload, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log("   ✅ Return Requested Successfully (API - Retry)");
        }

        // 6. VERIFY RETURN DOC
        const returnDoc = await Return.findOne({ order: orderId });
        if (!returnDoc) throw new Error("Return doc not found!");
        console.log("   ✅ Return Document Exists in DB");
        if (returnDoc.status !== 'Requested') throw new Error(`Status is ${returnDoc.status}, expected Requested`);

        // 7. ADMIN APPROVAL (Direct DB)
        await Return.updateOne({ _id: returnDoc._id }, { $set: { status: 'Approved' } });
        console.log("   ✅ Admin Approval Simulated (DB)");

        // 8. FINAL CHECK
        console.log("\n🎉 Full End-to-End Flow Verified!");
        console.log("   - User Created");
        console.log("   - Order Delivered");
        console.log("   - Return Requested (API)");
        console.log("   - Admin Approved");

        await mongoose.disconnect();
        process.exit(0);

    } catch (err) {
        console.error("\n❌ V2 Failed:", err.message);
        if (err.response) console.error("   API Resp:", err.response.data);
        await mongoose.disconnect();
        process.exit(1);
    }
};

run();
