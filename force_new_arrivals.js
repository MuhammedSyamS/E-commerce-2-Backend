const mongoose = require('mongoose');
const Product = require('./models/Product');
require('dotenv').config();

const forceNewArrivals = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB");

        // 1. Clear all old flags first to be clean
        await Product.updateMany({}, { $set: { isNewArrival: false }, $pull: { tags: "New Arrival" } });
        console.log("Cleared old flags.");

        // 2. Get 4 random products
        const products = await Product.aggregate([{ $sample: { size: 4 } }]);

        if (products.length === 0) {
            console.log("NO PRODUCTS FOUND IN DB!");
            process.exit();
        }

        // 3. Mark them
        const ids = products.map(p => p._id);
        await Product.updateMany(
            { _id: { $in: ids } },
            {
                $set: { isNewArrival: true },
                $addToSet: { tags: "New Arrival" }
            }
        );

        console.log(`Marked ${ids.length} products as New Arrival.`);

        // 4. Verify
        const check = await Product.countDocuments({ isNewArrival: true });
        console.log(`Verification Count: ${check}`);

        process.exit();
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
};

forceNewArrivals();
