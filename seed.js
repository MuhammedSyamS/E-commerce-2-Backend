const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('./models/Product'); // CORRECT: Import the actual model

dotenv.config();

const products = [
  // --- ELECTRONICS ---
  {
    name: "Noise-Cancelling Headphones",
    slug: "noise-cancelling-headphones",
    price: 15499,
    category: "Electronics",
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=800",
    isBestSeller: true,
    isNewArrival: false,
    numReviews: 320,
    reviews: [],
    rating: 4.8,
    description: "Premium wireless headphones with active noise cancellation and 30-hour battery life.",
    countInStock: 50
  },
  {
    name: "Mechanical Keychron K2",
    slug: "mechanical-keyboard-k2",
    price: 8999,
    category: "Electronics",
    image: "https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&q=80&w=800",
    isBestSeller: true,
    isNewArrival: true,
    numReviews: 150,
    reviews: [],
    rating: 4.9,
    description: "Wireless mechanical keyboard with Gateron Red switches and RGB backlight.",
    countInStock: 30
  },
  {
    name: "Smart Fitness Watch",
    slug: "smart-fitness-watch",
    price: 4999,
    category: "Electronics",
    image: "https://images.unsplash.com/photo-1579586337278-3befd40fd17a?auto=format&fit=crop&q=80&w=800",
    isBestSeller: false,
    isNewArrival: true,
    numReviews: 45,
    reviews: [],
    rating: 4.2,
    description: "Track your health metrics with precision. Waterproof and durable.",
    countInStock: 100
  },

  // --- FASHION ---
  {
    name: "Vintage Denim Jacket",
    slug: "vintage-denim-jacket",
    price: 3499,
    category: "Fashion",
    image: "https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9?auto=format&fit=crop&q=80&w=800",
    isBestSeller: true,
    isNewArrival: false,
    numReviews: 88,
    reviews: [],
    rating: 4.7,
    description: "Classic oversized denim jacket with a vintage wash.",
    countInStock: 40
  },
  {
    name: "Organic Cotton Tee",
    slug: "organic-cotton-tee",
    price: 999,
    category: "Fashion",
    image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=800",
    isBestSeller: false,
    isNewArrival: true,
    numReviews: 24,
    reviews: [],
    rating: 4.5,
    description: "100% organic cotton t-shirt. Breathable and sustainable.",
    countInStock: 150
  },
  {
    name: "Urban Cargo Pants",
    slug: "urban-cargo-pants",
    price: 2499,
    category: "Fashion",
    image: "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&q=80&w=800",
    isBestSeller: true,
    isNewArrival: false,
    numReviews: 112,
    reviews: [],
    rating: 4.6,
    description: "Functional cargo pants with multiple pockets and a tapered fit.",
    countInStock: 60
  },

  // --- HOME ---
  {
    name: "Minimalist Desk Lamp",
    slug: "minimalist-desk-lamp",
    price: 1899,
    category: "Home",
    image: "https://images.unsplash.com/photo-1507473888900-52e1adad54cd?auto=format&fit=crop&q=80&w=800",
    isBestSeller: false,
    isNewArrival: true,
    numReviews: 18,
    reviews: [],
    rating: 4.4,
    description: "Sleek LED desk lamp with adjustable brightness and color temperature.",
    countInStock: 25
  },
  {
    name: "Ceramic Plant Pot",
    slug: "ceramic-plant-pot",
    price: 799,
    category: "Home",
    image: "https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&q=80&w=800",
    isBestSeller: true,
    isNewArrival: false,
    numReviews: 56,
    reviews: [],
    rating: 4.8,
    description: "Hand-glazed ceramic pot, perfect for indoor plants.",
    countInStock: 80
  },

  // --- ACCESSORIES ---
  {
    name: "Leather Laptop Backpack",
    slug: "leather-laptop-backpack",
    price: 5999,
    category: "Accessories",
    image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&q=80&w=800",
    isBestSeller: true,
    isNewArrival: false,
    numReviews: 204,
    reviews: [],
    rating: 4.9,
    description: "Genuine leather backpack with padded laptop compartment.",
    countInStock: 20
  },
  {
    name: "Polarized Wayfarers",
    slug: "polarized-wayfarers",
    price: 2199,
    category: "Accessories",
    image: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&q=80&w=800",
    isBestSeller: false,
    isNewArrival: true,
    numReviews: 42,
    reviews: [],
    rating: 4.3,
    description: "Classic wayfarer sunglasses with UV400 polarized lenses.",
    countInStock: 45
  }
];

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Miso Studio DB Connected for Fresh Seed...");

    await Product.deleteMany();
    console.log("All previous items removed.");

    await Product.insertMany(products);
    console.log(`${products.length} Premium Silver Products Seeded Successfully!`);

    process.exit(0);
  } catch (error) {
    console.error("Seeding Error:", error.message);
    process.exit(1);
  }
};

seedDatabase();
