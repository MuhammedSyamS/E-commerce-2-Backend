const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Look = require('./models/Look');
const User = require('./models/User');
const Product = require('./models/Product');

dotenv.config();

const dummyLooks = [
  {
    image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&q=80&w=1000",
    caption: "Sun-kissed in the latest SLOOK essentials. ☀️",
    tagsCount: 2
  },
  {
    image: "https://images.unsplash.com/photo-1529139513477-42f4d9b73671?auto=format&fit=crop&q=80&w=1000",
    caption: "Minimalism is not a lack of something. It's the perfect amount of something.",
    tagsCount: 1
  },
  {
    image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&q=80&w=1000",
    caption: "Elegance is the only beauty that never fades.",
    tagsCount: 3
  },
  {
    image: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&q=80&w=1000",
    caption: "Style is a way to say who you are without having to speak.",
    tagsCount: 2
  },
  {
    image: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&q=80&w=1000",
    caption: "Ready for the weekend. #SlookStyle",
    tagsCount: 1
  }
];

const seedLooks = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB for Looks seeding...");

    // 1. Find a User
    const user = await User.findOne({ role: 'admin' }) || await User.findOne();
    if (!user) {
      console.error("❌ No user found. Please create a user first.");
      process.exit(1);
    }
    console.log(`👤 Assigning looks to user: ${user.email}`);

    // 2. Find some Products
    const products = await Product.find().limit(10);
    if (products.length === 0) {
      console.error("❌ No products found. Please seed products first.");
      process.exit(1);
    }

    // 3. Clear existing looks (optional, but good for "dummy" reset)
    // await Look.deleteMany({ status: 'approved' }); 
    // Let's not delete, just add.

    const looksToCreate = [];

    for (const data of dummyLooks) {
      const taggedProducts = [];
      // Pick random products to tag
      for (let i = 0; i < data.tagsCount; i++) {
        const randomProduct = products[Math.floor(Math.random() * products.length)];
        taggedProducts.push({
          product: randomProduct._id,
          name: randomProduct.name,
          price: randomProduct.price,
          image: randomProduct.image,
          slug: randomProduct.slug,
          x: Math.floor(Math.random() * 80) + 10, // 10-90%
          y: Math.floor(Math.random() * 80) + 10  // 10-90%
        });
      }

      looksToCreate.push({
        user: user._id,
        userName: `${user.firstName} ${user.lastName}`,
        image: data.image,
        caption: data.caption,
        products: taggedProducts,
        status: 'approved'
      });
    }

    await Look.insertMany(looksToCreate);
    console.log(`🚀 Successfully seeded ${looksToCreate.length} looks!`);

    process.exit(0);
  } catch (err) {
    console.error("❌ Seeding Error:", err.message);
    process.exit(1);
  }
};

seedLooks();
