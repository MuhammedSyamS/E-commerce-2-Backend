const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load env vars
dotenv.config({ path: 'c:/Users/Admin/Desktop/HighPhaus/server/.env' });

const checkLatestReview = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected...');

        const Product = require('./models/Product');

        // Aggregate to unwind reviews and sort by creation time
        const latestReviews = await Product.aggregate([
            { $unwind: "$reviews" },
            { $sort: { "reviews.createdAt": -1 } },
            { $limit: 1 },
            {
                $project: {
                    productName: "$name",
                    review: "$reviews"
                }
            }
        ]);

        if (latestReviews.length > 0) {
            const r = latestReviews[0];
            console.log("\n--- LATEST REVIEW FOUND IN DB ---");
            console.log(`Product: ${r.productName}`);
            console.log(`Rating: ${r.review.rating}`);
            console.log(`Comment: "${r.review.comment}"`);

            if (r.review.reviewImage) {
                console.log(`Image Detected: YES`);
                console.log(`Image Length: ${r.review.reviewImage.length} characters`);
                console.log(`Image Start: ${r.review.reviewImage.substring(0, 50)}...`);
            } else {
                console.log(`Image Detected: NO`);
            }

            console.log(`Date: ${r.review.createdAt}`);
            console.log("---------------------------------\n");
        } else {
            console.log("\n--- NO REVIEWS FOUND IN DB ---\n");
        }

        process.exit();
    } catch (error) {
        console.error("Check Failed:", error);
        process.exit(1);
    }
};

checkLatestReview();
