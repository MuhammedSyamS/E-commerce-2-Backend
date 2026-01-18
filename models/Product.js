const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  price: { type: Number, required: true },
  category: { type: String, required: true },
  image: { type: String, required: true },
  isBestSeller: { type: Boolean, default: false },
  reviews: { type: Number, default: 0 }
});

module.exports = mongoose.model('Product', productSchema);