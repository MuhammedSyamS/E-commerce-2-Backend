const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('./models/Product');
const User = require('./models/User');

dotenv.config();

const debugReviews = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("DB Connected.");

        // 1. List Users
        const users = await User.find({}, '_id firstName email');
        console.log("\n--- USERS ---");
        users.forEach(u => console.log(`ID: ${u._id}, Name: ${u.firstName}, Email: ${u.email}`));

        // 2. List All Reviews
        const products = await Product.find({ 'reviews.0': { $exists: true } }, 'name reviews');
        console.log("\n--- REVIEWS IN DB ---");

        let foundReviews = false;
        products.forEach(p => {
            p.reviews.forEach(r => {
                foundReviews = true;
                console.log(`Product: ${p.name}`);
                console.log(`  Review ID: ${r._id}`);
                console.log(`  User Field: ${r.user} (Type: ${typeof r.user})`);
                console.log(`  Rating: ${r.rating}`);
                console.log("------------------------------------------------");
            });
        });

        if (!foundReviews) console.log("NO REVIEWS FOUND IN ANY PRODUCT.");

        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

debugReviews();
