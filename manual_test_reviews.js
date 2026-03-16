const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const Product = require('./models/Product');
const User = require('./models/User');

const testReview = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("DB Connected.");

        const user = await User.findOne();
        if (!user) { console.log("No user found"); process.exit(); }

        const product = await Product.findOne();
        if (!product) { console.log("No product found"); process.exit(); }

        console.log(`Testing with Product: ${product.name}`);
        console.log(`Testing with User: ${user.firstName}`);

        // Mock a Cloudinary URL
        const mockCloudinaryUrl = "https://res.cloudinary.com/highphaus/image/upload/v123456789/products/test-image.jpg";
        
        const review = {
            name: user.firstName,
            rating: 5,
            comment: "TEST CLOUDINARY REVIEW - " + new Date().toISOString(),
            images: [mockCloudinaryUrl],
            videos: [],
            user: user._id,
            isVerifiedPurchase: true,
            helpful: []
        };

        product.reviews.push(review);
        await product.save();

        console.log("Review submitted with Cloudinary URL.");

        // Re-fetch to verify
        const updatedProduct = await Product.findById(product._id);
        const latestReview = updatedProduct.reviews[updatedProduct.reviews.length - 1];
        
        console.log("\n--- VERIFICATION ---");
        console.log(`Comment: ${latestReview.comment}`);
        console.log(`Images: ${JSON.stringify(latestReview.images)}`);
        
        if (latestReview.images[0] === mockCloudinaryUrl) {
            console.log("\n✅ SUCCESS: Cloudinary URL stored correctly.");
        } else {
            console.log("\n❌ FAILURE: Data mismatch!");
        }

        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

testReview();
