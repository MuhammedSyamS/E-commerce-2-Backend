const mongoose = require('mongoose');

const alertSchema = mongoose.Schema({
    type: {
        type: String,
        enum: ['low_stock', 'high_returns', 'system', 'payment_issue'],
        required: true
    },
    severity: {
        type: String,
        enum: ['info', 'warning', 'critical'],
        default: 'warning'
    },
    message: { type: String, required: true },
    relatedId: { type: mongoose.Schema.Types.ObjectId }, // Link to Product, Order, etc.
    isRead: { type: Boolean, default: false },
    metadata: { type: mongoose.Schema.Types.Mixed }
}, {
    timestamps: true
});

const Alert = mongoose.model('Alert', alertSchema);

module.exports = Alert;
