const mongoose = require('mongoose');

const broadcastSchema = new mongoose.Schema({
    subject: {
        type: String,
        required: true
    },
    content: {
        type: String, // HTML content
        required: true
    },
    targetAudience: {
        type: String,
        enum: ['Subscribers', 'Customers', 'All'],
        default: 'Subscribers'
    },
    sentCount: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['Draft', 'Sent'],
        default: 'Draft'
    },
    sentAt: {
        type: Date
    }
}, { timestamps: true });

module.exports = mongoose.model('Broadcast', broadcastSchema);
