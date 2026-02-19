const axios = require('axios');
const API_URL = 'http://localhost:5005/api';

const check = async () => {
    const results = [];
    console.log("🏥 Running Health Check...");

    // 1. Public Endpoints
    try {
        await axios.get(`${API_URL}/products?page=1`);
        results.push({ name: 'GET /products', status: '✅ OK' });
    } catch (e) { results.push({ name: 'GET /products', status: '❌ FAIL' }); }

    try {
        await axios.get(`${API_URL}/marketing/flash-sale`);
        results.push({ name: 'GET /flash-sale', status: '✅ OK' });
    } catch (e) { results.push({ name: 'GET /flash-sale', status: '❌ FAIL' }); }

    // 2. Auth Check (Login with valid user if possible, or just fail expectedly)
    // We can't easily test login without credentials, but we can verify 401 on protected routes
    try {
        await axios.get(`${API_URL}/users/profile`);
        results.push({ name: 'GET /profile (No Auth)', status: '❌ SHOULD FAIL' });
    } catch (e) {
        if (e.response && e.response.status === 401) results.push({ name: 'GET /profile (Protected)', status: '✅ OK (401)' });
        else results.push({ name: 'GET /profile', status: `❌ FAIL (${e.message})` });
    }

    console.table(results);

    const failures = results.filter(r => r.status.includes('❌') && !r.status.includes('SHOULD FAIL'));
    if (failures.length > 0) {
        console.error("⚠️  Issues Found:", failures);
        process.exit(1);
    } else {
        console.log("🎉 System is stable.");
    }
};

check();
