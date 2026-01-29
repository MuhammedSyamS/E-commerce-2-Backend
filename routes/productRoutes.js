const express = require('express');
const router = express.Router();

// Import your controller functions
const { 
  getProducts, 
  getProductBySlug, 
  createProductReview 
} = require('../controllers/productController');

// Import your authentication middleware
const { protect } = require('../middleware/authMiddleware');

/**
 * @route   GET /api/products
 * @desc    Fetch all products (used for shop and category filters)
 * @access  Public
 */
router.get('/', getProducts);

/**
 * @route   GET /api/products/:slug
 * @desc    Fetch a single product (Fixes the "Blank Page" issue)
 * @access  Public
 */
router.get('/:slug', getProductBySlug);

/**
 * @route   POST /api/products/:id/reviews
 * @desc    Create a new review (Star rating, Comment, and Image)
 * @access  Private
 */
router.post('/:id/reviews', protect, createProductReview);

// CRITICAL: Export the router so index.js can use it
module.exports = router;