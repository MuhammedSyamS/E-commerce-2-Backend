const mongoose = require('mongoose');
const Product = require('./models/Product');
const User = require('./models/User');

const MONGO_URI = "mongodb+srv://sharmaditya039:Adityasharma%40039@cluster0.jyr4b.mongodb.net/highphaus?retryWrites=true&w=majority&appName=Cluster0";

const debugReviews = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("Connected to DB");

        const products = await Product.find({ 'reviews.0': { $exists: true } });
        console.log(`Found ${products.length} products with reviews.`);

        let allReviews = [];

        products.forEach(p => {
            console.log(`Product: ${p.name} (Review Count: ${p.reviews.length})`);
            p.reviews.forEach(r => {
                console.log(` - Review by ${r.name || 'Unknown'}: ${r.comment}`);
                allReviews.push(r);
            });
        });

        console.log(`Total Aggregated Reviews: ${allReviews.length}`);

        if (allReviews.length === 0) {
            console.log("WARNING: Zero reviews found. Seed data might be missing or 'reviews' array is empty.");
        }

    } catch (err) {
        console.error(err);
    } finally {
        mongoose.connection.close();
    }
};

debugReviews();
