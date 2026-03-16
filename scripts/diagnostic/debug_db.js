const mongoose = require('mongoose');
const Product = require('./server/models/Product');
const SiteSettings = require('./server/models/SiteSettings');

const MONGO_URI = 'mongodb+srv://shamsaifudheen_db_user:TIPgwZykPJNVQ8Ru@ecommerce.bbxai9g.mongodb.net/highphaus?retryWrites=true&w=majority';

async function debug() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        const productCount = await Product.countDocuments();
        console.log('Product count:', productCount);

        const settings = await SiteSettings.findOne();
        console.log('Hero Slides:', settings?.heroSlides?.length || 0);

        const newArrivals = await Product.countDocuments({ isNewArrival: true });
        console.log('New Arrivals:', newArrivals);

        const bestSellers = await Product.countDocuments({ isBestSeller: true });
        console.log('Best Sellers:', bestSellers);

        const productsWithReviews = await Product.find({ 'reviews.0': { $exists: true } }).limit(5);
        console.log('Products with reviews count:', productsWithReviews.length);

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

debug();
