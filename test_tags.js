const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/highphaus').then(() => {
  const Product = require('./models/Product');
  Product.find({'tags.0': {$exists: true}}).select('name tags').lean().then((products) => {
    console.log(products);
    process.exit(0);
  });
});
