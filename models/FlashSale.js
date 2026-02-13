const mongoose = require('mongoose');

const flashSaleSchema = mongoose.Schema({
    name: { type: String, required: true },
    discountPercentage: { type: Number, required: true }, // e.g., 20 for 20% OFF
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }], // Specific products
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true
});

// Middleware to ensure only one sale is active at a time? 
// For now, let's allow overlapping but maybe frontend only shows the one ending soonest.

module.exports = mongoose.model('FlashSale', flashSaleSchema);
