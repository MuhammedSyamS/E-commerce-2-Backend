require('dotenv').config();
const mongoose = require('mongoose');

const fixData = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const db = mongoose.connection.db;
        const productsCollection = db.collection('products');

        // Find products where reviews is NOT an array (e.g. it's a number like 89)
        // $type 4 is Array. We want NOT Array.
        const cursor = productsCollection.find({
            $or: [
                { reviews: { $not: { $type: 4 } } },
                { reviews: { $exists: false } }
            ]
        });

        const badProducts = await cursor.toArray();
        console.log(`Found ${badProducts.length} products with invalid reviews format.`);

        for (const p of badProducts) {
            console.log(`Fixing product: ${p.name} (${p._id}) - Current reviews: ${p.reviews}`);

            await productsCollection.updateOne(
                { _id: p._id },
                {
                    $set: {
                        reviews: [],
                        numReviews: 0,
                        rating: 0
                    }
                }
            );
            console.log('Fixed.');
        }

        console.log('Done.');
        process.exit();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

fixData();
