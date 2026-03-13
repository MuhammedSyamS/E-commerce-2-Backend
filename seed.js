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
    description: "Functional cargo pants with multiple pockets and a tapered fit.",
    countInStock: 60
  },

  // --- HOME ---
  {
    name: "Minimalist Desk Lamp",
    slug: "minimalist-desk-lamp",
    price: 1899,
    category: "Home",
    image: "https://images.unsplash.com/photo-1534073828943-f801091bb18c?auto=format&fit=crop&q=80&w=800",
    isBestSeller: false,
    isNewArrival: true,
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
    description: "Genuine leather backpack with padded laptop compartment.",
    countInStock: 20
  },
  {
    name: "Polarized Wayfarers",
    slug: "polarized-wayfarers",
    price: 2199,
    category: "Accessories",
    image: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&q=80&w=800",
    isBestSeller: true,
    isNewArrival: true,
    description: "Classic wayfarer sunglasses with UV400 polarized lenses.",
    countInStock: 45
  },
  {
    name: "Silver Signet Ring",
    slug: "silver-signet-ring",
    price: 3999,
    category: "Accessories",
    image: "https://images.unsplash.com/photo-1611085583191-a3b1a30a218f?auto=format&fit=crop&q=80&w=800",
    isBestSeller: true,
    isNewArrival: true,
    description: "Minimalist stainless steel ring for a modern look.",
    countInStock: 20
  }
];

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("SLOOK Studio DB Connected for Smart Seed...");

    let updatedCount = 0;
    let createdCount = 0;

    for (const productData of products) {
      // Remove review fields to avoid overwriting genuine data
      const { reviews, numReviews, rating, ...updateData } = productData;

      const result = await Product.findOneAndUpdate(
        { slug: productData.slug },
        { 
          $set: updateData,
          $setOnInsert: { reviews: [], numReviews: 0, rating: 0 } 
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      
      if (result) {
        // Check if it was newly created (createdAt === updatedAt within a small margin)
        const isNew = result.createdAt.getTime() === result.updatedAt.getTime();
        if (isNew) createdCount++;
        else updatedCount++;
      }
    }

    console.log(`Seeding complete: ${createdCount} created, ${updatedCount} updated.`);
    console.log("Product IDs preserved for existing items.");

    process.exit(0);
  } catch (error) {
    console.error("Seeding Error:", error.message);
    process.exit(1);
  }
};

seedDatabase();
