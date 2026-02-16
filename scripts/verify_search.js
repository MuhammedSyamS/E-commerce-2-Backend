const mongoose = require('mongoose');
const Product = require('../models/Product');
const { searchProducts } = require('../controllers/productController');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Mock Objects
const mockRes = () => {
    const res = {};
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (data) => { res.data = data; return res; };
    return res;
};
const mockReq = (query) => ({ query });

const verifySearch = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB");

        // 1. Create a dummy product for search
        const testName = "UniqueSearchTerm_" + Date.now();
        const testProduct = await Product.create({
            name: testName,
            slug: "test-slug-" + Date.now(),
            price: 100,
            category: "Test",
            image: "http://example.com/img.jpg",
            description: "Test product for search verification"
        });
        console.log(`[SETUP] Created product: ${testName}`);

        // 2. Search for it
        console.log("\n--- Testing Search ---");
        const req = mockReq({ keyword: "UniqueSearch" });
        const res = mockRes();
        await searchProducts(req, res);

        if (res.data && res.data.length > 0) {
            const found = res.data.find(p => p.name === testName);
            if (found) {
                console.log("[PASS] Product found via search");
                console.log("Result:", found.name, found.price);
            } else {
                console.error("[FAIL] Product not found in results");
                console.log("Results:", res.data.map(p => p.name));
            }
        } else {
            console.error("[FAIL] No results returned");
        }

        // 3. Cleanup
        await Product.deleteOne({ _id: testProduct._id });
        console.log("\n[CLEANUP] Deleted test product");

    } catch (error) {
        console.error("Verification Error:", error);
    } finally {
        await mongoose.disconnect();
    }
};

verifySearch();
