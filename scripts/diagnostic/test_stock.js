const mongoose = require('mongoose');
const Product = require('./server/models/Product');
require('dotenv').config({ path: './server/.env' });

const runTest = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        // 1. Create Product with Variants
        console.log('Creating Product...');
        const product = new Product({
            name: 'Test Stock Product ' + Date.now(),
            slug: 'test-stock-' + Date.now(),
            price: 100,
            image: 'test.jpg',
            category: 'Test',
            variants: [
                { size: 'S', color: 'Red', stock: 10 },
                { size: 'M', color: 'Blue', stock: 20 }
            ],
            countInStock: 30 // Manual sum
        });

        const saved = await product.save();
        console.log(`Saved Product Stock: ${saved.countInStock}`);
        console.log(`Saved Variant 1 Stock: ${saved.variants[0].stock}`);
        console.log(`Saved Variant 2 Stock: ${saved.variants[1].stock}`);

        if (saved.countInStock !== 30) {
            console.error('FAIL: Initial Save Stock Mismatch!');
        } else {
            console.log('PASS: Initial Save Stock Correct.');
        }

        // 2. Fetch Fresh
        const fetched = await Product.findById(saved._id);
        console.log(`Fetched Product Stock: ${fetched.countInStock}`);

        // 3. Update Variant Stock via Save() logic
        console.log('Updating Variant Stock...');
        fetched.variants[0].stock = 5; // Total should be 25
        await fetched.save();

        const updated = await Product.findById(saved._id);
        console.log(`Updated Product Stock: ${updated.countInStock}`);

        if (updated.countInStock !== 25) {
            console.error(`FAIL: Updated Stock Mismatch. Expected 25, got ${updated.countInStock}`);
        } else {
            console.log('PASS: Updated Stock Correct via Pre-Save Hook.');
        }

        // 4. Update via updateOne (Bypasses Save Hook?)
        // This simulates what some controllers might do incorrectly
        // But productController.js updateProduct uses findById + save(), so it should be fine.

        // Clean up
        await Product.deleteOne({ _id: saved._id });
        console.log('Cleaned up.');

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.connection.close();
    }
};

runTest();
