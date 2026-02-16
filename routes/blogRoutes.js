const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const {
    getPublishedPosts,
    getAllPosts,
    getPostBySlug,
    createPost,
    updatePost,
    deletePost
} = require('../controllers/blogController');

// Public
router.get('/', getPublishedPosts); // /api/blog
router.get('/:slug', getPostBySlug);

// Admin
router.get('/admin/all', protect, admin, getAllPosts); // /api/blog/admin/all
router.post('/', protect, admin, createPost);
router.put('/:id', protect, admin, updatePost);
router.delete('/:id', protect, admin, deletePost);

module.exports = router;
