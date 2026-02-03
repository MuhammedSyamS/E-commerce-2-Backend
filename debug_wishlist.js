const mongoose = require('mongoose');
const User = require('./models/User');
const Product = require('./models/Product');
require('dotenv').config();

const debugWishlist = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB");

        // Find the first user (or specific one if we knew email)
        const user = await User.findOne({});
        if (!user) {
            console.log("No users found");
            return;
        }

        console.log(`Checking User: ${user.email}`);
        console.log(`Wishlist IDs in DB (${user.wishlist.length}):`, user.wishlist);

        console.log("--- Verifying Product Existence ---");
        const validIDs = [];
        for (const id of user.wishlist) {
            const product = await Product.findById(id);
            if (product) {
                console.log(`[VALID] ID: ${id} -> Product: ${product.name}`);
                validIDs.push(id);
            } else {
                console.log(`[INVALID] ID: ${id} -> Product NOT FOUND (Removing...)`);
            }
        }

        if (validIDs.length !== user.wishlist.length) {
            user.wishlist = validIDs;
            await user.save();
            console.log("CLEANUP COMPLETE: Wishlist updated.");
        }

        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

debugWishlist();
