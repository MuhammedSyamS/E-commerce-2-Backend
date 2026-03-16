const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('./models/Product');
const User = require('./models/User');

dotenv.config();

const diagnose = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("DB Connected.");

        const user = await User.findOne();
        if (!user) { console.log("NO USERS FOUND."); process.exit(); }

        console.log(`Current User: ${user._id} (${user.firstName})`);

        const products = await Product.find({ 'reviews.0': { $exists: true } });
        console.log(`Found ${products.length} products with reviews.`);

        let matchCount = 0;
        let mismatchCount = 0;

        products.forEach(p => {
            p.reviews.forEach(r => {
                console.log(`\nReview on '${p.name}':`);
                console.log(`  Review User ID: ${r.user}`);
                if (r.user && r.user.toString() === user._id.toString()) {
                    console.log("  MATCH! This review belongs to the user.");
                    matchCount++;
                } else {
                    console.log("  MISMATCH. This review belongs to someone else (or old user).");
                    mismatchCount++;
                }
            });
        });

        console.log(`\nSummary: ${matchCount} matches, ${mismatchCount} mismatches.`);

        // AUTO FIX: Claim all reviews for this user (since it is a dev env and user says they made them)
        if (mismatchCount > 0) {
            console.log("Attempting to CLAIM orphaned reviews for current user...");
            for (const p of products) {
                let changed = false;
                p.reviews.forEach(r => {
                    if (r.user.toString() !== user._id.toString()) {
                        r.user = user._id; // CLAIM IT
                        changed = true;
                    }
                });
                if (changed) {
                    await p.save();
                    console.log(`Fixed reviews for product: ${p.name}`);
                }
            }
        }

        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

diagnose();
