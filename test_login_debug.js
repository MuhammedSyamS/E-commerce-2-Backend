const axios = require('axios');

const testAuth = async () => {
    try {
        console.log("--- Testing Login Endpoint ---");
        const resLogin = await axios.post('http://localhost:5005/api/users/login', {
            email: 'nonexistent@example.com',
            password: 'password123'
        });
        console.log("Login Response Status:", resLogin.status);
    } catch (err) {
        console.log("Login Error Message:", err.response?.data?.message || err.message);
    }

    try {
        console.log("\n--- Testing OTP Sending ---");
        const testEmail = `test_${Date.now()}@example.com`;
        const resOtp = await axios.post('http://localhost:5005/api/users/send-otp', {
            email: testEmail
        });
        console.log("OTP Response Status:", resOtp.status);
        console.log("OTP Response Data:", JSON.stringify(resOtp.data, null, 2));
    } catch (err) {
        console.log("OTP Error Status:", err.response?.status);
        console.log("OTP Error Message:", err.response?.data?.message || err.message);
    }
};

testAuth();
