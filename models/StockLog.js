const mongoose = require('mongoose');

const stockLogSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    variant: {
        size: String,
        color: String
    },
    previousStock: { type: Number, required: true },
    newStock: { type: Number, required: true },
    change: { type: Number, required: true }, // e.g., -1, +10
    reason: {
        type: String,
        required: true,
        enum: ['Order', 'Restock', 'Admin Adjustment', 'Return', 'Order Cancelled', 'Cron Restore']
    },
    referenceId: { type: String }, // Order ID, or 'Admin'
    adminUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // If changed by admin
    description: { type: String } // Optional note
}, { timestamps: true });

module.exports = mongoose.model('StockLog', stockLogSchema);
