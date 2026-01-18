const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('./models/Product');

// HARDCODE YOUR MONGO URL HERE FOR LOCAL TESTING
// OR create a .env file with MONGO_URI=...
const MONGO_URI = 'mongodb://127.0.0.1:27017/miso_clone'; 

mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB Connected for Seeding'))
  .catch(err => console.error(err));

const products = [
  {
    name: "Eagle Adjustable Ring",
    slug: "eagle-adjustable-ring",
    price: 799,
    category: "Rings",
    image: "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&q=80&w=800",
    isBestSeller: true,
    reviews: 32
  },
  {
    name: "Batman Ring",
    slug: "batman-ring",
    price: 999,
    category: "Rings",
    image: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&q=80&w=800",
    isBestSeller: true,
    reviews: 15
  },
  {
    name: "Silver Croissant Cuff",
    slug: "silver-croissant-cuff",
    price: 599,
    category: "Earrings",
    image: "https://images.unsplash.com/photo-1630019852942-e5e12195308d?auto=format&fit=crop&q=80&w=800",
    isBestSeller: true,
    reviews: 8
  },
  {
    name: "Mountain Pendant",
    slug: "mountain-pendant",
    price: 1299,
    category: "Pendants",
    image: "https://images.unsplash.com/photo-1599643478518-17488fbbcd75?auto=format&fit=crop&q=80&w=800",
    isBestSeller: false,
    reviews: 4
  }
];

const seedDB = async () => {
  await Product.deleteMany({});
  await Product.insertMany(products);
  console.log("Database seeded successfully!");
  process.exit();
};

seedDB();