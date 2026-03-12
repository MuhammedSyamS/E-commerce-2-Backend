require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/Product');

async function testQuery() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected. Running query...');
    const start = Date.now();
    const reviews = await Product.aggregate([
      // 1. Only process products that actually have reviews (Massive performance boost)
      { $match: { "reviews.0": { $exists: true } } },
      
      // 2. Extract specific fields needed before unwinding to reduce memory overhead
      { 
        $project: { 
          name: 1, 
          slug: 1, 
          image: 1, 
          reviews: 1 
        } 
      },
      
      // 3. Unwind reviews
      { $unwind: "$reviews" },
      
      // 4. Sort and Limit
      { $sort: { "reviews.createdAt": -1 } },
      { $limit: 12 },
      
      // 5. Final Formatting
      {
        $project: {
          _id: 0,
          productName: "$name",
          productSlug: "$slug",
          productImage: "$image",
          review: "$reviews"
        }
      }
    ]);
    console.log(`Query finished in ${Date.now() - start}ms. Found ${reviews.length} reviews.`);
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
testQuery();
