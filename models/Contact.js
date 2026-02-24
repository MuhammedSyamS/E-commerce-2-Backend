const mongoose = require('mongoose');

const contactSchema = mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    subject: {
        type: String,
        required: false
    },
    message: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['New', 'Read', 'Replied'],
        default: 'New'
    },
    readByAdmin: {
        type: Boolean,
        default: false
    },
    adminReply: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Contact', contactSchema);
