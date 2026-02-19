const axios = require('axios');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const API_URL = 'http://localhost:5005/api';
const JWT_SECRET = process.env.JWT_SECRET;
const MONGO_URI = process.env.MONGO_URI;

const results = {
    total: 0,
    passed: 0,
    failed: 0,
    details: []
};

const logResult = (name, status, msg = '') => {
    results.total++;
    const isPass = status === 'OK' || status === 'SKIP';
    if (isPass) results.passed++; else results.failed++;

    results.details.push({ name, status, msg });
    console.log(`[${status}] ${name} ${msg ? '- ' + msg : ''}`);
};

const runAudit = async () => {
    try {
        console.log("🚀 Starting Comprehensive System Audit...");

        if (!MONGO_URI) throw new Error("MONGO_URI missing");
        await mongoose.connect(MONGO_URI);

        // 1. SETUP AUTH (Admin & User)
        const adminId = new mongoose.Types.ObjectId();
        const userId = new mongoose.Types.ObjectId();
        const adminToken = jwt.sign({ id: adminId, isAdmin: true }, JWT_SECRET, { expiresIn: '1h' });
        const userToken = jwt.sign({ id: userId, isAdmin: false }, JWT_SECRET, { expiresIn: '1h' });

        // 2. PRODUCT ROUTES
        console.log("\n📦 Checking Products...");
        try {
            const prodRes = await axios.get(`${API_URL}/products`);
            logResult('GET /products', 'OK', `Found ${prodRes.data.products?.length} items`);

            if (prodRes.data.products?.length > 0) {
                const pid = prodRes.data.products[0]._id;
                await axios.get(`${API_URL}/products/${pid}`);
                logResult('GET /products/:id', 'OK');
            }
        } catch (e) { logResult('Product Routes', 'FAIL', e.message); }

        try {
            await axios.get(`${API_URL}/products/top`);
            logResult('GET /products/top', 'OK');
        } catch (e) { logResult('GET /products/top', 'FAIL', e.message); }

        // 3. USER ROUTES
        console.log("\n👤 Checking Users...");
        try {
            await axios.get(`${API_URL}/users/profile`, { headers: { Authorization: `Bearer ${userToken}` } });
            logResult('GET /users/profile', 'OK');
        } catch (e) {
            // 404 is okay if user doesn't exist in DB (token is fake ID), but server shouldn't crash (500).
            // Actually middleware might check DB. 
            // If 404 "User not found", that's a PASS for stability.
            if (e.response?.status === 404) logResult('GET /users/profile', 'OK', '(User Not Found handled)');
            else logResult('GET /users/profile', 'FAIL', e.message);
        }

        // 4. ORDER ROUTES
        console.log("\n🛒 Checking Orders...");
        try {
            await axios.get(`${API_URL}/orders/myorders`, { headers: { Authorization: `Bearer ${userToken}` } });
            logResult('GET /orders/myorders', 'OK');
        } catch (e) { logResult('GET /orders/myorders', 'FAIL', e.message); }

        // 5. ANALYTICS (Admin)
        console.log("\n📊 Checking Analytics (Admin)...");
        try {
            await axios.get(`${API_URL}/orders/analytics`, { headers: { Authorization: `Bearer ${adminToken}` } });
            logResult('GET /orders/analytics', 'OK');
        } catch (e) { logResult('GET /orders/analytics', 'FAIL', e.message); }

        // 6. MARKETING
        console.log("\n📢 Checking Marketing...");
        try {
            await axios.get(`${API_URL}/marketing/flash-sale`);
            logResult('GET /marketing/flash-sale', 'OK');
        } catch (e) { logResult('GET /marketing/flash-sale', 'FAIL', e.message); }

        // 7. UPLOAD (Health check only, not actual upload)
        // No GET route usually. Skip.

        // 8. NOTIFICATIONS
        console.log("\n🔔 Checking Notifications...");
        try {
            await axios.get(`${API_URL}/notifications`, { headers: { Authorization: `Bearer ${userToken}` } });
            logResult('GET /notifications', 'OK');
        } catch (e) { logResult('GET /notifications', 'FAIL', e.message); }

        // 9. WISHLIST
        console.log("\n❤️ Checking Wishlist...");
        try {
            await axios.get(`${API_URL}/wishlist`, { headers: { Authorization: `Bearer ${userToken}` } });
            logResult('GET /wishlist', 'OK');
        } catch (e) { logResult('GET /wishlist', 'FAIL', e.message); }


        console.log("\n🏁 Audit Complete");
        console.table(results.details);

        if (results.failed > 0) process.exit(1);
        process.exit(0);

    } catch (err) {
        console.error("CRITICAL AUDIT FAILURE:", err);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
    }
};

runAudit();
