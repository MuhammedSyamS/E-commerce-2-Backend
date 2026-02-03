const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  name: { type: String, required: true },
  rating: { type: Number, required: true },
  comment: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  images: [{ type: String }], // Array of Base64 strings (Max 4)
  isApproved: { type: Boolean, default: true }, // Moderation
  adminResponse: { type: String } // Reply
}, { timestamps: true });

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  price: { type: Number, required: true },
  costPrice: { type: Number, default: 0 }, // NEW: For Profit Calculation
  category: { type: String, required: true },
  subcategory: { type: String }, // NEW
  image: { type: String, required: true }, // Main Thumbnail
  images: [{ type: String }], // NEW: Additional Images
  description: { type: String },
  specs: [{
    key: { type: String, required: true },
    value: { type: String, required: true }
  }], // Dynamic Specifications
  tags: [{ type: String }], // Custom Tags (e.g. "New Arrival", "Best Seller")
  isBestSeller: { type: Boolean, default: false }, // Keeping for backward compat, but tags will supersede
  discountPrice: { type: Number, default: 0 }, // Sale Price
  isFlashSale: { type: Boolean, default: false },
  flashSalePrice: { type: Number },
  flashSaleExpiry: { type: Date },
  countInStock: { type: Number, required: true, default: 0 },
  reviews: [reviewSchema],
  rating: { type: Number, required: true, default: 0 },
  numReviews: { type: Number, required: true, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);