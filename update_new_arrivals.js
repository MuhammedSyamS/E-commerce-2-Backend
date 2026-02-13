const mongoose = require('mongoose');
const Product = require('./models/Product');
require('dotenv').config();

const updateNewArrivals = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB");

        // Mark 5 random products as New Arrival
        const products = await Product.find().limit(20);

        if (products.length === 0) {
            console.log("No products found to update.");
            process.exit();
        }

        const shuffled = products.sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, 5);

        for (const p of selected) {
            p.isNewArrival = true;
            if (!p.tags.includes('New Arrival')) {
                p.tags.push('New Arrival');
            }
            await p.save();
            console.log(`Updated: ${p.name} as New Arrival`);
        }

        console.log("Done updating New Arrivals.");
        process.exit();
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
};

updateNewArrivals();
