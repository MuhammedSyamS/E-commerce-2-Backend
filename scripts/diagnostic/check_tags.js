require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    const Product = require('./models/Product');
    const products = await Product.find({'tags.0': {$exists: true}}).select('name tags').lean();
    console.log(JSON.stringify(products, null, 2));
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
