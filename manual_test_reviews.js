const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('./models/Product');
const User = require('./models/User');

dotenv.config();

const testReviews = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("DB Connected.");

        // 1. Get the first user (assuming this is the one logged in)
        const user = await User.findOne();
        if (!user) { console.log("No User Found"); process.exit(); }

        const userId = user._id; // ObjectId
        const userIdStr = userId.toString(); // String

        console.log(`Testing for User ID: ${userId}`);
        console.log(`ID Type: ${typeof userId}, Constructor: ${userId.constructor.name}`);

        // 2. Run Aggregation EXACTLY as in Controller
        const pipeline = [
            { $unwind: "$reviews" },
            {
                $match: {
                    $or: [
                        { "reviews.user": userId },          // ObjectId (mongoose handles casting usually, but let's be explicit)
                        { "reviews.user": userIdStr }        // String
                    ]
                }
            },
            {
                $project: {
                    productName: "$name",
                    reviewUser: "$reviews.user",
                    reviewUserType: { $type: "$reviews.user" }
                }
            }
        ];

        console.log("\n--- RUNNING AGGREGATION ---");
        const results = await Product.aggregate(pipeline);
        console.log(`Found ${results.length} reviews via Aggregation.`);
        results.forEach(r => {
            console.log(` - Product: ${r.productName} | User in Review: ${r.reviewUser} (Type: ${r.reviewUserType})`);
        });

        // 3. Debug if specific type fails
        if (results.length === 0) {
            console.log("\n--- DEBUGGING NO MATCH ---");
            // Find ANY review for this user manually
            const allProducts = await Product.find({ "reviews.user": userId });
            console.log(`Simple Find (ObjectId) found: ${allProducts.length} products.`);

            const allProductsStr = await Product.find({ "reviews.user": userIdStr });
            console.log(`Simple Find (String) found: ${allProductsStr.length} products.`);

            // Dump one review to inspect
            const p = await Product.findOne({ 'reviews.0': { $exists: true } });
            if (p) {
                console.log("Sample Review User Field:", p.reviews[0].user);
                console.log("Is ObjectId?", p.reviews[0].user instanceof mongoose.Types.ObjectId);
                console.log("Does it equal valid userId?", p.reviews[0].user.toString() === userIdStr);
            }
        }

        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

testReviews();
