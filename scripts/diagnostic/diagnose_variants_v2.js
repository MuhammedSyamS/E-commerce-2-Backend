const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

async function diagnose() {
    try {
        dotenv.config();
        const mongoUri = process.env.MONGO_URI;

        if (!mongoUri) {
            console.error("MONGO_URI not found in .env");
            return;
        }

        console.log("Connecting to Database...");
        await mongoose.connect(mongoUri);
        console.log("Connected.");

        const productSchema = new mongoose.Schema({
            name: String,
            countInStock: Number,
            variants: [{
                size: String,
                color: String,
                stock: Number
            }]
        });

        const Product = mongoose.model('Product', productSchema, 'products');

        const products = await Product.find({ 'variants.0': { '$exists': true } });
        console.log(`Found ${products.length} products with variants.`);

        products.forEach(p => {
            console.log(`\nProduct: ${p.name} (Total Stock: ${p.countInStock})`);
            if (!p.variants || p.variants.length === 0) {
                console.log("  - No variants found in array.");
            } else {
                p.variants.forEach(v => {
                    console.log(`  - [${v.size} / ${v.color}]: Stock = ${v.stock}`);
                });
            }
        });

        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

diagnose();
