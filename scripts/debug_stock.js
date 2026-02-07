require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product');

mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
        console.log("Connected to DB");
        const products = await Product.find({}, 'name countInStock');
        console.log("--- STOCK REPORT ---");
        products.forEach(p => {
            console.log(`${p.name}: ${p.countInStock}`);
        });
        console.log("--- END REPORT ---");
        process.exit();
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
