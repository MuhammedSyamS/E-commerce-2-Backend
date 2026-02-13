const mongoose = require('mongoose');
const Product = require('./models/Product');
require('dotenv').config();

const restoreNewArrivals = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB");

        // Get 5 random products
        const products = await Product.aggregate([{ $sample: { size: 5 } }]);

        for (const p of products) {
            await Product.updateOne(
                { _id: p._id },
                {
                    $set: { isNewArrival: true },
                    $addToSet: { tags: "New Arrival" }
                }
            );
            console.log(`Marked ${p.name} as New Arrival`);
        }

        console.log("Restored New Arrivals section.");
        process.exit();
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
};

restoreNewArrivals();
