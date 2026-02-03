const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('../models/Product');
const User = require('../models/User');

dotenv.config();

const fixNames = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('DB Connected');

        const products = await Product.find({});
        let count = 0;

        for (const product of products) {
            let modified = false;
            if (product.reviews && product.reviews.length > 0) {
                for (const review of product.reviews) {
                    if (review.user) {
                        const user = await User.findById(review.user);
                        if (user) {
                            const properName = `${user.firstName} ${user.lastName}`;
                            if (review.name !== properName) {
                                console.log(`Updating ${review.name} -> ${properName}`);
                                review.name = properName;
                                modified = true;
                                count++;
                            }
                        }
                    }
                }
            }
            if (modified) {
                await product.save();
            }
        }

        console.log(`Updated ${count} reviews.`);
        process.exit();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

fixNames();
