
require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product');

const checkDb = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const count = await Product.countDocuments();
        console.log(`Database Connected. Product Count: ${count}`);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};
checkDb();
