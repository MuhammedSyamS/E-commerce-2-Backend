const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('./models/Product');
const User = require('./models/User');

dotenv.config();

const debugState = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("DB Connected.\n");

        // 1. Fetch All Users
        const users = await User.find({}, '_id firstName email');
        const userMap = {};
        console.log("=== USERS ===");
        users.forEach(u => {
            userMap[u._id.toString()] = `${u.firstName} (${u.email})`;
            console.log(`[${u._id}] ${u.email}`);
        });

        // 2. Fetch All Reviews
        const products = await Product.find({ 'reviews.0': { $exists: true } });
        console.log("\n=== REVIEWS ===");

        let totalReviews = 0;
        products.forEach(p => {
            p.reviews.forEach(r => {
                totalReviews++;
                // Handle complex or simple user field
                let uid = r.user;
                if (uid && uid._id) uid = uid._id; // Handle populated

                const uidStr = uid ? uid.toString() : 'NULL';
                const ownerName = userMap[uidStr] || "UNKNOWN USER";

                console.log(`Product: ${p.name.substring(0, 20)}...`);
                console.log(` - Review by User ID: [${uidStr}]`);
                console.log(` - Owner Identity: ${ownerName}`);
                console.log(` - Rating: ${r.rating}`);
                console.log("");
            });
        });

        if (totalReviews === 0) console.log("No reviews found in DB.");

        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

debugState();
