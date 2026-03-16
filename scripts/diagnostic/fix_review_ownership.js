const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('./models/Product');
const User = require('./models/User');

dotenv.config();

const fixReviews = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("DB Connected.");

        // 1. Find the LATEST user (the one likely logged in now)
        const activeUser = await User.findOne().sort({ createdAt: -1 });
        if (!activeUser) { console.log("No users."); process.exit(); }

        console.log(`Target User (Latest): ${activeUser.firstName} (${activeUser.email}) ID: ${activeUser._id}`);

        // 2. Find ALL products with reviews
        const products = await Product.find({ 'reviews.0': { $exists: true } });
        console.log(`Found ${products.length} products with reviews.`);

        let count = 0;
        for (const p of products) {
            let modified = false;
            p.reviews.forEach(r => {
                if (r.user.toString() !== activeUser._id.toString()) {
                    console.log(` - Transferring review on '${p.name}' from ${r.user} to ${activeUser._id}`);
                    r.user = activeUser._id;
                    modified = true;
                    count++;
                }
            });
            if (modified) await p.save();
        }

        console.log(`\nSUCCESS: Transferred ${count} reviews to user ${activeUser.firstName}.`);
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

fixReviews();
