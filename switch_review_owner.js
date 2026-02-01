const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('./models/Product');
const User = require('./models/User');

dotenv.config();

const switchOwner = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("DB Connected.");

        // 1. Find all users
        const users = await User.find();
        if (users.length < 2) {
            console.log("Not enough users to switch. Manual fix required.");
            // If only 1 user, ensure reviews belong to them
            if (users.length === 1) {
                console.log("Only 1 user found. Ensuring ownership...");
                const singleUser = users[0];
                await Product.updateMany(
                    { 'reviews.0': { $exists: true } },
                    { $set: { "reviews.$[].user": singleUser._id } }
                );
                console.log("All set to single user.");
            }
            process.exit();
        }

        // 2. Find a review to see who owns it currently
        const product = await Product.findOne({ 'reviews.0': { $exists: true } });
        if (!product) { console.log("No reviews to switch."); process.exit(); }

        const currentOwnerId = product.reviews[0].user;
        console.log(`Current Owner ID: ${currentOwnerId}`);

        // 3. Find the OTHER user
        const newOwner = users.find(u => u._id.toString() !== currentOwnerId.toString());

        if (!newOwner) {
            console.log("Could not find a different user.");
            process.exit();
        }

        console.log(`Switching ownership to: ${newOwner.firstName} (${newOwner.email}) ID: ${newOwner._id}`);

        // 4. Transfer ALL reviews to New Owner
        const products = await Product.find({ 'reviews.0': { $exists: true } });
        for (const p of products) {
            p.reviews.forEach(r => {
                r.user = newOwner._id;
            });
            await p.save();
        }

        console.log("Ownership Switched Successfully.");
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

switchOwner();
