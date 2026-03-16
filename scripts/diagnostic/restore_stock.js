const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load env vars
dotenv.config();

const Product = require('./models/Product');

const restoreStock = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("DB Connected.");

        // Read the dump file
        // Try reading as utf16le since view_file complained, or utf8
        let content;
        try {
            content = fs.readFileSync('stock_dump.txt', 'utf16le');
        } catch (e) {
            content = fs.readFileSync('stock_dump.txt', 'utf8');
        }

        const lines = content.split('\n');

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.includes('---')) continue;

            // Format seems to be: "Name: Count"
            // Split by FIRST colon to handle names with colons if any, though unlikely for names
            const parts = trimmed.split(':');
            if (parts.length < 2) continue;

            const name = parts[0].trim();
            const stockRaw = parts[1].trim();
            const stock = parseInt(stockRaw, 10);

            if (name && !isNaN(stock)) {
                console.log(`Restoring ${name} -> ${stock}`);
                const res = await Product.updateOne({ name: name }, { $set: { countInStock: stock } });
                if (res.matchedCount === 0) {
                    console.warn(`⚠️ Product not found: ${name}`);
                }
            }
        }

        console.log("Stock restoration complete.");
        process.exit(0);

    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
};

restoreStock();
