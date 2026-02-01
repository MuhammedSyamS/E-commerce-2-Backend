const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('./models/Product');
const User = require('./models/User');

dotenv.config();

const debugReviews = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB...");

        // 1. Fetch all users
        const users = await User.find({});
        console.log(`Total Users: ${users.length}`);
        if (users.length > 0) {
            console.log("Sample User ID:", users[0]._id);
        }

        // 2. Fetch all products with reviews
        const productsWithReviews = await Product.find({ "reviews.0": { $exists: true } });
        console.log(`Products with reviews: ${productsWithReviews.length}`);

        if (productsWithReviews.length > 0) {
            const p = productsWithReviews[0];
            console.log("Sample Product Review:", JSON.stringify(p.reviews[0], null, 2));
            console.log("Review User ID Type:", typeof p.reviews[0].user);
        } else {
            console.log("NO REVIEWS FOUND IN DB. The list is naturally empty.");
        }

        // 3. Simulate the Aggregation
        if (users.length > 0) {
            const userId = users[0]._id;
            console.log(`\nTesting Aggregation for User: ${userId}`);

            const agg = await Product.aggregate([
                { $unwind: "$reviews" },
                { $match: { "reviews.user": userId } }, // This matches ObjectId strictness often
                { $project: { "reviews.comment": 1, "reviews.user": 1 } }
            ]);

            console.log(`Aggregation Found: ${agg.length} matches.`);
        }

        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

debugReviews();
