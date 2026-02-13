const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true, uppercase: true },
    discountType: { type: String, enum: ['percentage', 'fixed'], required: true },
    discountAmount: { type: Number, required: true },
    minPurchase: { type: Number, default: 0 },
    expiryDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    usedCount: { type: Number, default: 0 },
    isFirstOrderOnly: { type: Boolean, default: false },

    // Advanced Customization
    eligibleProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    eligibleCategories: [{ type: String }],
    usageLimit: { type: Number, default: null }, // Max global uses
    perUserLimit: { type: Number, default: null } // Max uses per user
}, { timestamps: true });

module.exports = mongoose.model('Coupon', couponSchema);
