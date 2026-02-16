const mongoose = require('mongoose');
const Broadcast = require('../models/Broadcast');
const Newsletter = require('../models/Newsletter');
const User = require('../models/User');
const { createBroadcast, getBroadcasts } = require('../controllers/marketingController');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Mock Response Object
const mockRes = () => {
    const res = {};
    res.status = (code) => {
        res.statusCode = code;
        return res;
    };
    res.json = (data) => {
        res.data = data;
        return res;
    };
    return res;
};

// Mock Request Object
const mockReq = (body) => ({
    body
});

const verifyBroadcast = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB");

        // 1. Setup Test Data
        const testEmail = `test_${Date.now()}@example.com`;
        await Newsletter.create({ email: testEmail, isSubscribed: true });
        console.log(`Created test subscriber: ${testEmail}`);

        // 2. Test Create & Send Broadcast (Controller directly to avoid Auth wiring in script)
        console.log("\n--- Testing Create & Send Broadcast ---");
        const req = mockReq({
            subject: "Test Broadcast",
            content: "<h1>Hello World</h1>",
            targetAudience: "Subscribers",
            status: "Sent"
        });
        const res = mockRes();

        await createBroadcast(req, res);

        if (res.statusCode === 201) {
            console.log("[PASS] Broadcast Created & Sent");
            console.log("Response:", res.data);
            if (res.data.sentCount > 0) {
                console.log(`[PASS] Sent Count: ${res.data.sentCount}`);
            } else {
                console.warn(`[WARN] Sent Count is 0 (Might be async issue or no subscribers)`);
            }
        } else {
            console.error("[FAIL] Broadcast Creation Failed", res.data);
        }

        // 3. Test Get Broadcasts
        console.log("\n--- Testing Get Broadcasts ---");
        const reqGet = {};
        const resGet = mockRes();
        await getBroadcasts(reqGet, resGet);

        if (resGet.data && resGet.data.length > 0) {
            console.log(`[PASS] Retrieved ${resGet.data.length} broadcasts`);
            console.log("Latest:", resGet.data[0].subject);
        } else {
            console.error("[FAIL] No broadcasts found");
        }

        // Cleanup
        await Newsletter.deleteOne({ email: testEmail });
        // Optional: Delete the broadcast created? Keeping it for audit might be fine.

    } catch (error) {
        console.error("Verification Failed:", error);
    } finally {
        await mongoose.disconnect();
    }
};

verifyBroadcast();
