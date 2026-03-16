
const mongoose = require('mongoose');
const Product = require('./models/Product');
require('dotenv').config();

const resetNewArrivals = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB");

        // 1. Clear ALL New Arrival flags/tags
        console.log("Clearing existing New Arrival flags...");
        const updateResult = await Product.updateMany(
            {},
            {
                $set: { isNewArrival: false },
                $pull: { tags: { $in: ['New Arrival', 'New'] } }
            }
        );
        console.log(`Cleared flags from ${updateResult.modifiedCount} products.`);

        // 2. Select 5 random products
        const count = await Product.countDocuments();
        const rand = Math.floor(Math.random() * (count - 5));
        const products = await Product.find().skip(rand > 0 ? rand : 0).limit(20); // Fetch a chunk

        const shuffled = products.sort(() => 0.5 - Math.random()).slice(0, 5);

        // 3. Set New Arrival for these 5
        for (const p of shuffled) {
            p.isNewArrival = true;
            if (!p.tags) p.tags = [];
            p.tags.push('New Arrival');
            await p.save();
            console.log(`Marked as New Arrival: ${p.name}`);
        }

        console.log("Done resetting New Arrivals.");
        process.exit();
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
};

resetNewArrivals();
