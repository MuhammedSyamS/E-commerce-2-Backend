require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/Product');

async function cleanBadData() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    // Find products where the image string starts with 'data:image' and is extremely long
    // The problematic image is a 'data:image/avif;base64' string that is ~3MB
    const result = await Product.updateMany(
      { image: { $regex: /^data:image/i } },
      { $set: { image: '/uploads/placeholder.jpg' } } 
    );
    
    console.log(`Updated ${result.modifiedCount} products with massive base64 images.`);

    // Also check variants just in case
    const products = await Product.find({ 'variants.image': { $regex: /^data:image/i } });
    let variantUpdates = 0;
    for (let p of products) {
      let changed = false;
      for (let v of p.variants) {
        if (v.image && v.image.startsWith('data:image')) {
          v.image = '/uploads/placeholder.jpg';
          changed = true;
        }
      }
      if (changed) {
        await p.save();
        variantUpdates++;
      }
    }
    console.log(`Updated variants in ${variantUpdates} products.`);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

cleanBadData();
