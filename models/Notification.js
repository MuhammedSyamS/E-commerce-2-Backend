const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Specific user (optional)
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, enum: ['system', 'order', 'promo'], default: 'system' },
    isRead: { type: Boolean, default: false },
    data: { type: Object }, // Optional payload (e.g. url, orderId)
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
