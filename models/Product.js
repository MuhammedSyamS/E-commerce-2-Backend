const mongoose = require('mongoose');
const { optimizeCloudinaryUrl } = require('../utils/imageUtils');

const reviewSchema = new mongoose.Schema({
  name: { type: String, required: true },
  rating: { type: Number, required: true },
  comment: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  images: [{ type: String }], // Array of Base64 strings (Max 10)
  videos: [{ type: String }], // Array of Base64 strings (Max 5) - Enforced on Frontend
  isApproved: { type: Boolean, default: true }, // Moderation
  adminResponse: { type: String }, // Reply
  isVerifiedPurchase: { type: Boolean, default: false }, // NEW: Verified Badge
  helpful: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }] // NEW: Helpful Votes
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
  isNewArrival: { type: Boolean, default: false }, // NEW: Optimized Flag
  isBestSeller: { type: Boolean, default: false }, // Keeping for backward compat, but tags will supersede
  discountPrice: { type: Number, default: 0 }, // Sale Price
  isFlashSale: { type: Boolean, default: false },
  flashSalePrice: { type: Number },
  flashSaleExpiry: { type: Date },
  countInStock: { type: Number, required: true, default: 0 },
  badge: { type: String }, // NEW: Primary badge (e.g. "New Arrival", "Trending", "Home Appliances")

  // NEW: Advanced Fields
  video: { type: String }, // YouTube or File URL
  variants: [{
    size: { type: String },
    color: { type: String },
    stock: { type: Number, default: 0 },
    price: { type: Number }, // Optional override
    image: { type: String } // NEW: Color-specific picture
  }],
  seo: {
    metaTitle: { type: String },
    metaDescription: { type: String },
    keywords: [{ type: String }]
  },
  richDescription: { type: String }, // HTML

  reviews: [reviewSchema],
  rating: { type: Number, required: true, default: 0 },
  numReviews: { type: Number, required: true, default: 0 },
  viewCount: { type: Number, default: 0 }
}, { timestamps: true });

// INDEXES FOR PERFORMANCE
productSchema.index({ isNewArrival: 1 });
productSchema.index({ isBestSeller: 1 });
productSchema.index({ isFlashSale: 1 });
productSchema.index({ discountPrice: 1 });
productSchema.index({ category: 1 });
productSchema.index({ subcategory: 1 });
productSchema.index({ rating: -1 });
productSchema.index({ viewCount: -1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ price: 1 });
productSchema.index({ name: 'text', tags: 'text', description: 'text', category: 'text' }); // For Keyword Search
productSchema.index({ name: 1 }); // Standard index for regex/exact match
productSchema.index({ tags: 1 }); // Standard index for tag filtering
productSchema.index({ 'variants.size': 1, 'variants.color': 1 });
productSchema.index({ badge: 1 });

// ENFORCE STOCK CONSISTENCY
// ENFORCE STOCK CONSISTENCY
productSchema.pre('save', async function () {
  if (this.variants && this.variants.length > 0) {
    const totalVariantStock = this.variants.reduce((acc, curr) => acc + (Number(curr.stock) || 0), 0);
    // Only update if inconsistent
    if (this.countInStock !== totalVariantStock) {
      console.log(`Auto-Updating Stock for ${this.name}: ${this.countInStock} -> ${totalVariantStock}`);
      this.countInStock = totalVariantStock;
    }
  }
});

module.exports = mongoose.model('Product', productSchema);
