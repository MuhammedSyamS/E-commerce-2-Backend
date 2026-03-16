const mongoose = require('mongoose');

const MONGO_URI = "mongodb+srv://shamsaifudheen_db_user:TIPgwZykPJNVQ8Ru@ecommerce.bbxai9g.mongodb.net/slook?retryWrites=true&w=majority";

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    price: { type: Number, required: true },
    description: { type: String },
    category: { type: String, required: true },
    subcategory: { type: String },
    image: { type: String },
    countInStock: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 },
    isBestSeller: { type: Boolean, default: false },
    isNewArrival: { type: Boolean, default: false },
    tags: [{ type: String }],
    rating: { type: Number, default: 0 },
    numReviews: { type: Number, default: 0 }
}, { timestamps: true });

const Product = mongoose.models.Product || mongoose.model('Product', productSchema);

const seed = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected');

        const products = [
            {
                name: "Phantom Mesh Chair",
                slug: "phantom-mesh-chair-" + Date.now(),
                price: 28500,
                description: "Zero-gravity ergonomics with breathable tech-mesh.",
                category: "Furniture",
                image: "https://images.pexels.com/photos/37347/office-chair-isolated-white-background.jpg?auto=compress&cs=tinysrgb&w=1600",
                countInStock: 8,
                viewCount: 4200,
                tags: ["Trending", "Office"]
            },
            {
                name: "Cypher Mechanical Board",
                slug: "cypher-keyboard-" + Date.now(),
                price: 15900,
                description: "Brushed aluminum base with tactile linear switches.",
                category: "Accessories",
                image: "https://images.pexels.com/photos/841228/pexels-photo-841228.jpeg?auto=compress&cs=tinysrgb&w=1600",
                countInStock: 25,
                viewCount: 3100,
                tags: ["Trending", "Tech"]
            },
            {
                name: "Vantage Mirror Cabinet",
                slug: "vantage-mirror-" + Date.now(),
                price: 12000,
                description: "Smart-lit mirror with hidden storage and anti-fog tech.",
                category: "Home Decor",
                image: "https://images.pexels.com/photos/6636254/pexels-photo-6636254.jpeg?auto=compress&cs=tinysrgb&w=1600",
                countInStock: 12,
                viewCount: 2900,
                tags: ["Trending"]
            },
            {
                name: "Aura Glass Vase",
                slug: "aura-glass-vase-" + Date.now(),
                price: 4500,
                description: "Iridescent hand-blown glass with organic silhouette.",
                category: "Home Decor",
                image: "https://images.pexels.com/photos/1036396/pexels-photo-1036396.jpeg?auto=compress&cs=tinysrgb&w=1600",
                countInStock: 30,
                viewCount: 5200,
                tags: ["Trending"]
            },
            {
                name: "Nebula Projector",
                slug: "nebula-projector-" + Date.now(),
                price: 35000,
                description: "4K laser projection in a compact, matte-black housing.",
                category: "Accessories",
                image: "https://images.pexels.com/photos/437037/pexels-photo-437037.jpeg?auto=compress&cs=tinysrgb&w=1600",
                countInStock: 6,
                viewCount: 6800,
                tags: ["Trending", "Tech"]
            }
        ];

        await Product.insertMany(products);
        console.log('Seeded');
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

seed();
