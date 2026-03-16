const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: 'c:/Users/Admin/Desktop/HighPhaus/server/.env' });

(async () => {
    await mongoose.connect(process.env.MONGO_URI);
    const Product = require('./models/Product');
    const r = (await Product.aggregate([
        { $unwind: "$reviews" }, { $sort: { "reviews.createdAt": -1 } }, { $limit: 1 }
    ]))[0];

    if (r) {
        console.log("LAST_COMMENT:", r.reviews.comment);
        console.log("HAS_IMAGE:", !!r.reviews.reviewImage);
    }
    process.exit();
})();
