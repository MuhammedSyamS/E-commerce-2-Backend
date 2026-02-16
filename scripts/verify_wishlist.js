const axios = require('axios');
const mongoose = require('mongoose');
const User = require('../models/User');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const verifyWishlistSharing = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB");

        // 1. GET RANDOM USER WITH WISHLIST
        // Find a user who has items in wishlist
        const user = await User.findOne({ wishlist: { $exists: true, $not: { $size: 0 } } });

        if (!user) {
            console.log("No user with wishlist items found. Skipping test.");
            return;
        }

        const userId = user._id.toString();
        console.log(`Testing Public Wishlist for User: ${user.email} (${userId})`);

        // 2. TEST PUBLIC ENDPOINT
        try {
            const res = await axios.get(`http://localhost:5005/api/wishlist/shared/${userId}`);
            console.log(`[PASS] Shared Wishlist Retrieved. Items: ${res.data.length}`);
            if (res.data.length > 0) {
                console.log(`- First Item: ${res.data[0].name}`);
            }
        } catch (err) {
            console.error(`[FAIL] Shared Wishlist Failed:`, err.response?.data?.message || err.message);
        }

        // 3. TEST INVALID USER ID
        try {
            const fakeId = new mongoose.Types.ObjectId();
            await axios.get(`http://localhost:5005/api/wishlist/shared/${fakeId}`);
            console.error(`[FAIL] Invalid User ID should have failed!`);
        } catch (err) {
            if (err.response?.status === 404) {
                console.log(`[PASS] Invalid User ID correctly returned 404`);
            } else {
                console.error(`[FAIL] Unexpected error for invalid ID:`, err.message);
            }
        }

    } catch (error) {
        console.error("Verification Failed:", error);
    } finally {
        await mongoose.disconnect();
    }
};

verifyWishlistSharing();
