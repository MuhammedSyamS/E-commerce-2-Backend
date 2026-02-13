
const mongoose = require('mongoose');
const Product = require('./models/Product');
require('dotenv').config();

const checkNewArrivals = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB");

        const newArrivals = await Product.find({
            $or: [
                { isNewArrival: true },
                { tags: 'New Arrival' },
                { tags: 'New' }
            ]
        });

        console.log(`Found ${newArrivals.length} products marked as New Arrival.`);
        newArrivals.forEach(p => {
            console.log(`- ${p.name} (ID: ${p._id}) | isNewArrival: ${p.isNewArrival} | Tags: ${p.tags}`);
        });

        const allProducts = await Product.countDocuments();
        console.log(`Total products in DB: ${allProducts}`);

        process.exit();
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
};

checkNewArrivals();
