const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('./models/Product');

dotenv.config();

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const p = await Product.findOne();
        if (p) console.log("SLUG: " + p.slug);
        else console.log("No product found");
        process.exit();
    } catch (e) { console.error(e); process.exit(1); }
};
run();
