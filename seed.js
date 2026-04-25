const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('./models/Product'); // CORRECT: Import the actual model

dotenv.config();

const categories = ['Fashion', 'Electronics', 'Home', 'Accessories', 'Groceries', 'Beauty', 'Toys', 'Books', 'Appliances', 'Automotive', 'Sports'];
const images = {
  'Fashion': [
    'https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9',
    'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab',
    'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80',
    'https://images.unsplash.com/photo-1434389677669-e08b4cac3105',
    'https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3'
  ],
  'Electronics': [
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e',
    'https://images.unsplash.com/photo-1595225476474-87563907a212',
    'https://images.unsplash.com/photo-1579586337278-3befd40fd17a',
    'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2',
    'https://images.unsplash.com/photo-1546868871-7041f2a55e12'
  ],
  'Home': [
    'https://images.unsplash.com/photo-1534073828943-f801091bb18c',
    'https://images.unsplash.com/photo-1485955900006-10f4d324d411',
    'https://images.unsplash.com/photo-1586023492125-27b2c045efd7',
    'https://images.unsplash.com/photo-1524758631624-e2822e304c36',
    'https://images.unsplash.com/photo-1583847268964-b28dc2f51ac9'
  ],
  'Accessories': [
    'https://images.unsplash.com/photo-1553062407-98eeb64c6a62',
    'https://images.unsplash.com/photo-1572635196237-14b3f281503f',
    'https://images.unsplash.com/photo-1635767798638-3e25273a8236',
    'https://images.unsplash.com/photo-1523170335258-f5ed11844a49',
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30'
  ],
  'Groceries': [
    'https://images.unsplash.com/photo-1542838132-92c53300491e',
    'https://images.unsplash.com/photo-1542838132-92c53300491e',
    'https://images.unsplash.com/photo-1516594798947-e65505dbb29d'
  ],
  'Beauty': [
    'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9',
    'https://images.unsplash.com/photo-1596462502278-27bfdc4033c8',
    'https://images.unsplash.com/photo-1512496015851-a90fb38ba796'
  ],
  'Toys': [
    'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1',
    'https://images.unsplash.com/photo-1456121087144-ec2035821051',
    'https://images.unsplash.com/photo-1558877385-81a1c7e67d72'
  ],
  'Books': [
    'https://images.unsplash.com/photo-1544947950-fa07a98d237f',
    'https://images.unsplash.com/photo-1495446815901-a7297e633e8d',
    'https://images.unsplash.com/photo-1512820790803-83ca734da794'
  ],
  'Appliances': [
    'https://images.unsplash.com/photo-1584622650111-993a426fbf0a',
    'https://images.unsplash.com/photo-1527383418406-f85a3b146499',
    'https://images.unsplash.com/photo-1574362848149-11496d93a7c7'
  ],
  'Automotive': [
    'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7',
    'https://images.unsplash.com/photo-1503376780353-7e6692767b70',
    'https://images.unsplash.com/photo-1494976388531-d1058494cdd8'
  ],
  'Sports': [
    'https://images.unsplash.com/photo-1517649763962-0c623066013b',
    'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5',
    'https://images.unsplash.com/photo-1517836357463-d25dfeac3438'
  ]
};

const productPrefixes = ['Premium', 'Luxury', 'Minimalist', 'Essential', 'Urban', 'Elite', 'Studio', 'Vintage'];
const productSuffixes = {
  'Fashion': ['Tee', 'Jacket', 'Pants', 'Hoodie', 'Coat', 'Sneakers', 'Denim', 'Knit'],
  'Electronics': ['Headphones', 'Keyboard', 'Watch', 'Mouse', 'Monitor', 'Tablet', 'Speaker', 'Dock'],
  'Home': ['Lamp', 'Vase', 'Chair', 'Table', 'Rug', 'Diffuser', 'Frame', 'Shelving'],
  'Accessories': ['Backpack', 'Sunglasses', 'Ring', 'Wallet', 'Belt', 'Hat', 'Scarf', 'Tote'],
  'Groceries': ['Coffee', 'Snack Pack', 'Organic Juice', 'Spices', 'Honey', 'Pasta', 'Tea'],
  'Beauty': ['Serum', 'Moisturizer', 'Perfume', 'Lipstick', 'Shampoo', 'Mask', 'Oil'],
  'Toys': ['Action Figure', 'Puzzle', 'Drone', 'Game', 'Plush', 'Lego Set', 'Robot'],
  'Books': ['Novel', 'Biography', 'Journal', 'Guide', 'Anthology', 'Collection'],
  'Appliances': ['Coffee Maker', 'Toaster', 'Air Purifier', 'Vacuum', 'Fan', 'Mixer'],
  'Automotive': ['Cleaning Kit', 'Dashboard Cam', 'Tool Set', 'Organizer', 'Cover'],
  'Sports': ['Dumbbells', 'Yoga Mat', 'Bottle', 'Gym Bag', 'Resistance Band', 'Ball']
};

const generateProducts = () => {
  const generated = [];
  for (let i = 1; i <= 200; i++) {
    const category = categories[Math.floor(Math.random() * categories.length)];
    const prefix = productPrefixes[Math.floor(Math.random() * productPrefixes.length)];
    const suffix = productSuffixes[category][Math.floor(Math.random() * productSuffixes[category].length)];
    const name = `${prefix} ${suffix} ${i}`;
    const slug = name.toLowerCase().replace(/\s+/g, '-') + '-' + i;
    
    generated.push({
      name,
      slug,
      price: Math.floor(Math.random() * 20000) + 499,
      category,
      image: `${images[category][Math.floor(Math.random() * images[category].length)]}?auto=format&fit=crop&q=80&w=800`,
      isBestSeller: Math.random() > 0.8,
      isNewArrival: Math.random() > 0.7,
      description: `Official ${name} artifact. Designed for the SLOOK ecosystem with premium performance and style.`,
      countInStock: Math.floor(Math.random() * 100) + 10
    });
  }
  return generated;
};

const products = generateProducts();

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("SLOOK Studio DB Connected for Smart Seed...");

    let updatedCount = 0;
    let createdCount = 0;

    for (const productData of products) {
      // Remove review fields to avoid overwr
      const { reviews, numReviews, rating, ...updateData } = productData;

      const result = await Product.findOneAndUpdate(
        { slug: productData.slug },
        { 
          $set: updateData,
          $setOnInsert: { reviews: [], numReviews: 0, rating: 0 } 
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
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
