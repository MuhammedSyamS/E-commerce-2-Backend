const mongoose = require('mongoose');
const Product = require('./models/Product');

async function checkSpecs() {
    try {
        await mongoose.connect('mongodb://localhost:27017/slook');
        console.log('Connected to MongoDB');

        const products = await Product.find({});
        const allSpecs = new Set();
        const specMap = {};

        products.forEach(p => {
            if (p.specs && p.specs.length > 0) {
                p.specs.forEach(s => {
                    allSpecs.add(s.key);
                    if (!specMap[s.key]) specMap[s.key] = new Set();
                    specMap[s.key].add(s.value);
                });
            }
        });

        console.log('Available Spec Keys:', Array.from(allSpecs));
        for (const key in specMap) {
            console.log(`${key}:`, Array.from(specMap[key]));
        }

        mongoose.connection.close();
    } catch (err) {
        console.error(err);
    }
}

checkSpecs();
