const axios = require('axios');
const API_URL = 'http://localhost:5005/api';

const run = async () => {
    console.log("🧪 Testing Edge Cases...");
    let failed = false;

    // 1. Invalid ID format (CastError handling)
    try {
        await axios.get(`${API_URL}/products/123`); // Malformed ID
        console.log("❌ GET /products/123 Should have failed");
        failed = true;
    } catch (e) {
        if (e.response && (e.response.status === 404 || e.response.status === 400)) {
            console.log(`✅ GET /products/123 handled correctly (${e.response.status})`);
        } else {
            console.log(`❌ GET /products/123 returned unexpected status: ${e.response?.status}`);
            failed = true;
        }
    }

    // 2. Empty Body POST (Validation handling)
    try {
        await axios.post(`${API_URL}/auth/login`, {});
        console.log("❌ POST /auth/login {} Should have failed");
        failed = true;
    } catch (e) {
        if (e.response && e.response.status === 400) {
            console.log(`✅ POST /auth/login {} handled correctly (400)`);
        } else {
            console.log(`❌ POST /auth/login {} returned unexpected status: ${e.response?.status}`);
            failed = true;
        }
    }

    if (failed) process.exit(1);
    console.log("🎉 Edge Cases Verified.");
};

run();
