const axios = require('axios');
const mongoose = require('mongoose');

const API_URL = 'http://localhost:5005/api';

// 1. Setup Data
const testUser = {
    firstName: 'Test', lastName: 'User', email: `test.return.${Date.now()}@example.com`, password: 'password123'
};
const testAdmin = {
    email: 'admin@example.com', password: 'password123' // Assuming this admin exists from seed
};

let userToken = '';
let adminToken = '';
let orderId = '';
let itemId = '';

const run = async () => {
    try {
        console.log("🚀 Starting End-to-End Return Flow Verification...");

        // --- STEP 1: AUTH ---
        console.log("\n1️⃣  Registering Test User...");
        try {
            const regRes = await axios.post(`${API_URL}/auth/register`, testUser);
            userToken = regRes.data.token;
            console.log("   ✅ User Registered");
        } catch (e) {
            console.log("   ⚠️  User might exist, logging in...");
            const loginRes = await axios.post(`${API_URL}/auth/login`, { email: testUser.email, password: testUser.password });
            userToken = loginRes.data.token;
            console.log("   ✅ User Logged In");
        }

        console.log("2️⃣  Logging in Admin...");
        // NOTE: If this fails, we can't test admin steps. 
        // We'll assume the standard admin exists. If not, we might need to verify manual flows or seed one.
        // For now, let's try to login a known admin or create one if possible (admin creation usually restricted).
        // Let's Skip actual admin login if we don't know credentials and assume we can simulate admin actions if we have a way, 
        // OR we just test the user side mostly. 
        // Actually, let's try to login. If fail, we abort gracefully.
        try {
            // Try a common dev admin or just skip if we can't. 
            // BETTER: We can mock the admin token if we have access to the DB (we do).
            // But for an external script, let's try the user flow first.
            console.log("   ℹ️  Skipping Admin Login for script (credentials unknown). Logic verification relies on User & System state.");
        } catch (e) { }


        // --- STEP 2: CREATE ORDER ---
        console.log("\n3️⃣  Creating a Test Order...");
        // active product fetch
        const products = await axios.get(`${API_URL}/products?page=1`);
        const product = products.data.products[0];
        if (!product) throw new Error("No products found to order");

        itemId = product._id;

        const orderData = {
            orderItems: [{
                product: product._id,
                name: product.name,
                image: product.image,
                price: product.price,
                quantity: 1,
                selectedVariant: product.variants?.[0] || { size: 'M', color: 'Black' }
            }],
            shippingAddress: { address: '123 Test St', city: 'Test City', postalCode: '12345', country: 'Test Country' },
            paymentMethod: 'COD',
            itemsPrice: product.price,
            taxPrice: 0,
            shippingPrice: 0,
            totalPrice: product.price
        };

        const orderRes = await axios.post(`${API_URL}/orders`, orderData, {
            headers: { Authorization: `Bearer ${userToken}` }
        });
        orderId = orderRes.data._id;
        console.log(`   ✅ Order Created: ${orderId}`);


        // --- STEP 3: MARK DELIVERED (MOCK ADMIN) ---
        // Since we don't have admin token in this script easily without credentials,
        // we will use a direct DB update helper if we were running inside the server.
        // BUT, since we are external, we might hit a generic "developer backdoor" if one existed, OR
        // we just acknowledge we might fail this step if we can't be admin.
        // WAIT: I can just use the 'run_command' to execute a mongo script to update the order!
        // That is safer.
        console.log("\n4️⃣  Simulating Delivery (via external DB update needed)...");
        console.log("   ⚠️  Cannot mark Delivered via API without Admin Token.");
        console.log("   ⚠️  Please manually mark order " + orderId + " as DELIVERED in Mongo/Compass.");

        // For the sake of this script being automated, I will stop here and ask the user to verify,
        // OR I can write a separate tool call to update the DB directly. 

        // Let's proceed to try the RETURN logic assuming it *was* delivered (it will fail if not).
        // Actually, I can use the 'run_command' to invoke a node script that connects to Mongoose and updates it!
        // I will do that in the NEXT tool call.

    } catch (err) {
        console.error("❌ Verification Failed:", err.response?.data?.message || err.message);
    }
};

run();
