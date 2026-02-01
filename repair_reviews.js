const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load env vars
dotenv.config({ path: 'c:/Users/Admin/Desktop/HighPhaus/server/.env' });

const repairData = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected for Repair...');

        // Access the collection directly to avoid Schema Validation errors blocking us
        const productsCollection = mongoose.connection.collection('products');

        // Find documents where 'reviews' is NOT an array
        // type 4 is Array. So $not: { $type: 4 }
        const cursor = productsCollection.find({
            reviews: { $not: { $type: 4 } }
        });

        const badDocs = await cursor.toArray();
        console.log(`Found ${badDocs.length} corrupted products.`);

        for (const doc of badDocs) {
            console.log(`Fixing Product ID: ${doc._id} | Current Value: ${doc.reviews}`);

            await productsCollection.updateOne(
                { _id: doc._id },
                {
                    $set: {
                        reviews: [],
                        numReviews: 0,
                        rating: 0
                    }
                }
            );
            console.log(`-> Fixed ${doc._id}`);
        }

        console.log("Repair Complete.");
        process.exit();
    } catch (error) {
        console.error("Repair Failed:", error);
        process.exit(1);
    }
};

repairData();
