const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('../models/Product');
const User = require('../models/User');

dotenv.config({ path: '.env' });

const seedReviews = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('DB Connected');

        const products = await Product.find({});
        const users = await User.find({});

        if (products.length === 0 || users.length === 0) {
            console.log('Not enough products or users to seed reviews.');
            process.exit();
        }

        const comments = [
            "Great product! Really loved the quality.",
            "Not what I expected, but customer service was helpful.",
            "Amazing value for money. Highly recommended!",
            "Fast shipping and good packaging.",
            "The color was slightly different than the picture.",
            "Best purchase I've made this year!",
            "It fits perfectly. Will buy again.",
            "Average quality, nothing special.",
            "Five stars! Exceeded my expectations.",
            "Would not recommend for the price."
        ];

        let totalAdded = 0;

        for (const product of products) {
            // Clear existing reviews first to avoid duplicates if re-run
            // product.reviews = []; 

            // Add 1-3 reviews per product
            const numReviews = Math.floor(Math.random() * 3) + 1;

            for (let i = 0; i < numReviews; i++) {
                const user = users[Math.floor(Math.random() * users.length)];
                const rating = Math.floor(Math.random() * 5) + 1;
                const comment = comments[Math.floor(Math.random() * comments.length)];

                const review = {
                    user: user._id,
                    name: `${user.firstName} ${user.lastName}`,
                    rating: rating,
                    comment: comment,
                    createdAt: new Date(),
                    isApproved: true,
                    helpful: []
                };

                product.reviews.push(review);
                totalAdded++;
            }

            // Recalculate stats
            product.numReviews = product.reviews.length;
            product.rating = product.reviews.reduce((acc, item) => item.rating + acc, 0) / product.reviews.length;

            await product.save();
            console.log(`Updated ${product.name} with ${numReviews} new reviews.`);
        }

        console.log(`Successfully added ${totalAdded} reviews across ${products.length} products.`);
        process.exit();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

seedReviews();
