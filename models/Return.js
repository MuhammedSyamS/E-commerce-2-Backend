const mongoose = require('mongoose');

const returnSchema = mongoose.Schema({
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Snapshot of item being returned (to keep record if Order changes)
    orderItem: {
        itemId: { type: mongoose.Schema.Types.ObjectId }, // Link to original subdocument
        name: { type: String, required: true },
        qty: { type: Number, required: true },
        image: { type: String, required: true },
        price: { type: Number, required: true },
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        selectedVariant: {
            size: String,
            color: String
        }
    },
    type: {
        type: String,
        enum: ['Return', 'Exchange'],
        default: 'Return'
    },
    reason: { type: String, required: true },
    comment: { type: String },
    images: [String],

    // LIFECYCLE STATE
    status: {
        type: String,
        enum: [
            'Requested',
            'Approved',
            'Rejected',
            'Pickup Scheduled',
            'Picked Up',
            'Received',
            'QC Pending',
            'QC Passed',
            'QC Failed',
            'Refund Initiated',
            'Refund Completed',
            'Replacement Sent',
            'Replacement Delivered',
            'Exchanged'
        ],
        default: 'Requested'
    },

    // LOGISTICS
    pickupDetails: {
        method: { type: String, enum: ['Pickup', 'Self Ship'], default: 'Pickup' },
        scheduledDate: Date,
        courier: String,
        trackingId: String
    },

    // QUALITY CHECK
    qcDetails: {
        status: { type: String, enum: ['Passed', 'Failed', 'Pending'], default: 'Pending' },
        adminComment: String,
        checkedAt: Date,
        checkedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    },

    // RESOLUTION
    resolutionDetails: {
        refundAmount: Number,
        replacementOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
        resolvedAt: Date
    },

    // FULL AUDIT TIMELINE
    timeline: [
        {
            status: String,
            date: { type: Date, default: Date.now },
            note: String,
            user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } // Admin or Customer who triggered it
        }
    ],

    // Admin Internal Notes
    adminComment: { type: String }

}, {
    timestamps: true
});

const Return = mongoose.model('Return', returnSchema);

module.exports = Return;
