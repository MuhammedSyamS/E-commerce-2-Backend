const mongoose = require('mongoose');

const chatMessageSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    message: {
        type: String,
        required: true
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    isRead: {
        type: Boolean,
        default: false
    },
    tempId: {
        type: String
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
