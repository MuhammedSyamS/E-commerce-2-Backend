const mongoose = require('mongoose');

const blogPostSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    slug: {
        type: String,
        required: true,
        unique: true
    },
    content: {
        type: String, // Likely HTML from a rich text editor
        required: true
    },
    coverImage: {
        type: String // URL
    },
    author: {
        type: String,
        default: 'SLOOK Team'
    },
    tags: [{
        type: String
    }],
    isPublished: {
        type: Boolean,
        default: false
    },
    publishedAt: {
        type: Date
    }
}, { timestamps: true });

// Hook removed to avoid issues. Slug generated in controller.

module.exports = mongoose.model('BlogPost', blogPostSchema);
