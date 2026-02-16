const mongoose = require('mongoose');

const waitlistSchema = new mongoose.Schema({
    email: { type: String, required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    variant: {
        size: { type: String },
        color: { type: String }
    },
    isNotified: { type: Boolean, default: false },
    notifiedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Waitlist', waitlistSchema);
