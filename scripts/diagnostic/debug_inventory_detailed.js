const mongoose = require('mongoose');
const Product = require('./models/Product');
const dotenv = require('dotenv');

dotenv.config();

const checkInventory = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB.");

        const products = await Product.find({});
        console.log(`Found ${products.length} products.`);

        let issues = 0;

        products.forEach(p => {
            console.log(`\nProduct: ${p.name} (ID: ${p._id})`);
            console.log(`  - Main Stock: ${p.countInStock}`);

            if (p.variants && p.variants.length > 0) {
                const totalVariantStock = p.variants.reduce((acc, v) => acc + (Number(v.stock) || 0), 0);
                console.log(`  - Variants: ${p.variants.length}`);
                p.variants.forEach(v => {
                    console.log(`    - [${v.size}/${v.color}]: ${v.stock}`);
                });
                console.log(`  - Sum of Variants: ${totalVariantStock}`);

                if (p.countInStock !== totalVariantStock) {
                    console.error(`  >>> MISMATCH! Main Stock (${p.countInStock}) != Variant Sum (${totalVariantStock})`);
                    issues++;
                }
            } else {
                console.log("  - No Variants.");
            }
        });

        console.log(`\nTotal Stock Issues Found: ${issues}`);
        process.exit();

    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
};

checkInventory();
