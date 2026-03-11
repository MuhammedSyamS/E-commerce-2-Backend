const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');
// Fix: Look for .env in the server directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const Product = require('../models/Product');
const User = require('../models/User');

const seedReviews = async () => {
    try {
        console.log('Connecting to:', process.env.MONGO_URI);
        await mongoose.connect(process.env.MONGO_URI);
        console.log('DB Connected');

        const products = await Product.find({});
        const users = await User.find({});

        if (products.length === 0 || users.length === 0) {
            console.log('Not enough products or users to seed reviews.');
            process.exit();
        }

        const comments = [
            "Great product! Really loved the quality. The design is so premium.",
            "Amazing value for money. Highly recommended for daily use!",
            "Fast shipping and good packaging. The item arrived in perfect condition.",
            "Best purchase I've made this year! Definitely worth every penny.",
            "It fits perfectly and looks stunning. Will buy again from SLOOK.",
            "Five stars! Exceeded my expectations in terms of performance and style."
        ];

        const sampleImages = [
            "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=800",
            "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=800",
            "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=800",
            "https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&q=80&w=800"
        ];

        let totalAdded = 0;

        for (const product of products) {
            // Add 1-2 reviews per product
            const numReviews = Math.floor(Math.random() * 2) + 1;

            for (let i = 0; i < numReviews; i++) {
                const user = users[Math.floor(Math.random() * users.length)];
                const rating = Math.floor(Math.random() * 2) + 4; // 4 or 5 stars
                const comment = comments[Math.floor(Math.random() * comments.length)];
                
                // Add some sample images to some reviews
                const reviewImages = Math.random() > 0.3 ? [sampleImages[Math.floor(Math.random() * sampleImages.length)]] : [];

                const review = {
                    user: user._id,
                    name: `${user.firstName} ${user.lastName}`,
                    rating: rating,
                    comment: comment,
                    images: reviewImages,
                    createdAt: new Date(),
                    isApproved: true,
                    isVerifiedPurchase: true,
                    helpful: []
                };

                product.reviews.push(review);
                totalAdded++;
            }

            // Recalculate stats
            product.numReviews = product.reviews.length;
            product.rating = product.reviews.reduce((acc, item) => item.rating + acc, 0) / product.reviews.length;

            await product.save();
            console.log(`Updated ${product.name} with reviews.`);
        }

        console.log(`Successfully added ${totalAdded} reviews across ${products.length} products.`);
        process.exit();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

seedReviews();
