const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

async function diagnose() {
    try {
        const envPath = path.join(__dirname, 'server', '.env');
        const envContent = fs.readFileSync(envPath, 'utf8');
        const mongoUriLine = envContent.split('\n').find(l => l.includes('MONGO_URI='));
        if (!mongoUriLine) {
            console.error("MONGO_URI not found in .env");
            return;
        }
        const mongoUri = mongoUriLine.split('=')[1].trim();

        console.log("Connecting to:", mongoUri.split('@')[1] || "local");
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
            if (p.variants.length === 0) {
                console.log("  - No variants found in array.");
            }
            p.variants.forEach(v => {
                console.log(`  - [${v.size} / ${v.color}]: Stock = ${v.stock}`);
            });
        });

        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

diagnose();
