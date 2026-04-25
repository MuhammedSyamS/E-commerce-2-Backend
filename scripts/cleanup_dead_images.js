const mongoose = require('mongoose');
const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Product = require('../models/Product');

async function cleanupDeadImages() {
  try {
    console.log('--- Product Image Health Check ---');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to Database.');

    const products = await Product.find().select('name image slug');
    console.log(`Auditing ${products.length} products...`);

    let deadCount = 0;
    let checkedCount = 0;

    for (const product of products) {
      checkedCount++;
      const url = product.image;

      if (!url || !url.startsWith('http')) {
        console.log(`[SKIPPING] ${product.name} - Invalid URL: ${url}`);
        continue;
      }

      try {
        // Use HEAD request to check if image exists (faster than GET)
        await axios.head(url, { timeout: 5000 });
        // console.log(`[OK] ${product.name}`);
      } catch (error) {
        if (error.response && error.response.status === 404) {
          console.log(`[DEAD/404] ${product.name} - ${url}`);
          
          // REMOVE PRODUCT
          await Product.deleteOne({ _id: product._id });
          console.log(`[DELETED] Removed product: ${product.name}`);
          deadCount++;
        } else {
          console.warn(`[WARNING] ${product.name} - Error ${error.response?.status || error.message}`);
        }
      }

      if (checkedCount % 20 === 0) {
        console.log(`Progress: ${checkedCount}/${products.length}...`);
      }
    }

    console.log('-----------------------------------');
    console.log(`Audit Complete.`);
    console.log(`Total Checked: ${checkedCount}`);
    console.log(`Total Removed (404): ${deadCount}`);
    console.log('-----------------------------------');

    process.exit(0);
  } catch (error) {
    console.error('CRITICAL ERROR:', error);
    process.exit(1);
  }
}

cleanupDeadImages();
