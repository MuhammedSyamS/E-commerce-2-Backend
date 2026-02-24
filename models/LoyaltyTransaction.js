const mongoose = require('mongoose');

const loyaltyTransactionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ['earn', 'spend', 'refund', 'bonus', 'referral', 'expire'],
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    expiryDate: {
        type: Date,
        required: false // Only for 'earn' types
    },
    isExpired: {
        type: Boolean,
        default: false
    },
    referenceId: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'referenceModel'
    },
    referenceModel: {
        type: String,
        enum: ['Order', 'Return', 'User'],
        default: 'Order'
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'cancelled'],
        default: 'completed'
    }
}, { timestamps: true });

module.exports = mongoose.model('LoyaltyTransaction', loyaltyTransactionSchema);
