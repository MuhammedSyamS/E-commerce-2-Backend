const express = require('express');
const router = express.Router();
const { protect, admin, hasPermission } = require('../middleware/authMiddleware');
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
router.get('/admin/all', protect, hasPermission('manage_blog'), getAllPosts); // /api/blog/admin/all
router.post('/', protect, hasPermission('manage_blog'), createPost);
router.put('/:id', protect, hasPermission('manage_blog'), updatePost);
router.delete('/:id', protect, admin, deletePost);

module.exports = router;
