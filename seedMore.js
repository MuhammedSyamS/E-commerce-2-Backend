require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/Product');

const seedTrendingProducts = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB Atlas');

        const trendingProducts = [
            {
                name: "Noir Elite Timepiece",
                slug: "noir-elite-timepiece-" + Math.floor(Math.random() * 1000),
                price: 12500,
                description: "Aerospace-grade titanium housing with a vacuum-hardened sapphire crystal.",
                richDescription: "The Noir Elite is more than a watch; it's a statement of precision and industrial elegance.",
                category: "Accessories",
                subcategory: "Timepieces",
                image: "https://images.pexels.com/photos/190819/pexels-photo-190819.jpeg?auto=compress&cs=tinysrgb&w=1600",
                countInStock: 15,
                viewCount: 1500,
                isBestSeller: true,
                tags: ["Best Seller", "Trending"],
                rating: 4.9,
                numReviews: 42
            },
            {
                name: "Alpine Minimalist Desk",
                slug: "alpine-minimalist-desk-" + Math.floor(Math.random() * 1000),
                price: 45000,
                description: "Hand-finished solid oak with brushed steel legs.",
                category: "Furniture",
                subcategory: "Office",
                image: "https://images.pexels.com/photos/1297611/pexels-photo-1297611.jpeg?auto=compress&cs=tinysrgb&w=1600",
                countInStock: 5,
                viewCount: 2200,
                isNewArrival: true,
                tags: ["New Arrival", "Trending"],
                rating: 5.0,
                numReviews: 12
            },
            {
                name: "Lunar Diffuser v2",
                slug: "lunar-diffuser-v2-" + Math.floor(Math.random() * 1000),
                price: 3200,
                description: "Ultrasonic technology meets stone-matte aesthetics.",
                category: "Home Decor",
                subcategory: "Wellness",
                image: "https://images.pexels.com/photos/6707628/pexels-photo-6707628.jpeg?auto=compress&cs=tinysrgb&w=1600",
                countInStock: 50,
                viewCount: 3500,
                tags: ["Trending"],
                rating: 4.7,
                numReviews: 89
            },
            {
                name: "Obsidian Ceramic Set",
                slug: "obsidian-ceramic-set-" + Math.floor(Math.random() * 1000),
                price: 8900,
                description: "Double-fired charcoal ceramic with a raw edge finish.",
                category: "Home Decor",
                subcategory: "Dining",
                image: "https://images.pexels.com/photos/4207892/pexels-photo-4207892.jpeg?auto=compress&cs=tinysrgb&w=1600",
                countInStock: 20,
                viewCount: 1800,
                tags: ["Trending", "Best Seller"],
                rating: 4.8,
                numReviews: 24
            },
            {
                name: "Industrial Floor Lamp",
                slug: "industrial-floor-lamp-" + Math.floor(Math.random() * 1000),
                price: 18500,
                description: "Cold-rolled steel with a warm filament glow.",
                category: "Home Decor",
                subcategory: "Lighting",
                image: "https://images.pexels.com/photos/1123262/pexels-photo-1123262.jpeg?auto=compress&cs=tinysrgb&w=1600",
                countInStock: 10,
                viewCount: 2800,
                tags: ["Trending"],
                rating: 4.9,
                numReviews: 31
            }
        ];

        await Product.insertMany(trendingProducts);
        console.log('Successfully seeded 5 trending products.');

        process.exit();
    } catch (error) {
        console.error('Seeding Error:', error);
        process.exit(1);
    }
};

seedTrendingProducts();
