const mongoose = require('mongoose');
const axios = require('axios');
const User = require('./models/User');
const Otp = require('./models/Otp');
const dotenv = require('dotenv');

dotenv.config();

const API_BASE = 'http://localhost:5005/api/users';

const testFullFlow = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB for direct inspection");

        // CLEANUP PREVIOUS TESTS
        await User.deleteMany({ email: { $regex: /antigravity_test|ref_/ } });
        await Otp.deleteMany({ email: { $regex: /antigravity_test|ref_/ } });

        const testEmail = `antigravity_test_${Date.now()}@example.com`;
        const testPassword = 'TestPassword123!';

        // 1. Send OTP
        console.log(`\n1. Sending OTP to ${testEmail}...`);
        await axios.post(`${API_BASE}/send-otp`, { email: testEmail });
        console.log("OTP request sent successfully.");

        // 2. Read OTP from DB (bypass email)
        const otpDoc = await Otp.findOne({ email: testEmail });
        if (!otpDoc) throw new Error("OTP not found in database!");
        console.log(`Found OTP in DB: ${otpDoc.code}`);

        // 3. Register User with a dummy referral code
        console.log("\n2. Registering User with Referral...");
        // First create a referrer user
        const referrer = await User.create({
            firstName: 'Referrer',
            lastName: 'User',
            email: `ref_${Date.now()}@example.com`,
            password: 'password123',
            referralCode: 'TESTREF'
        });

        const resReg = await axios.post(`${API_BASE}/register`, {
            firstName: 'Test',
            lastName: 'User',
            email: testEmail,
            password: testPassword,
            code: otpDoc.code,
            referralCode: 'TESTREF'
        });
        console.log("Registration Success!");

        // 4. Verify User in DB (Check hash)
        const userInDb = await User.findOne({ email: testEmail });
        console.log(`User created. Hash starts with: ${userInDb.password.substring(0, 10)}...`);

        // 5. Try Login
        console.log("\n3. Attempting Login...");
        const resLogin = await axios.post(`${API_BASE}/login`, {
            email: testEmail,
            password: testPassword
        });
        console.log("Login Success! Token received.");

    } catch (err) {
        console.error("\n❌ FLOW FAILED:");
        if (err.response) {
            console.error(`Status: ${err.response.status}`);
            console.error(`Message: ${err.response.data.message || JSON.stringify(err.response.data)}`);
        } else {
            console.error(err.message);
        }
    } finally {
        await mongoose.connection.close();
        process.exit();
    }
};

testFullFlow();
