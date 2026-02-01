const express = require('express');
const router = express.Router();

// Import your controller functions
const {
  getProducts,
  getProductBySlug,
  createProductReview,
  deleteProductReview,
  getFeaturedReviews, // Added this import
  getUserReviews // Added this import
} = require('../controllers/productController');

// Import your authentication middleware
const { protect, admin } = require('../middleware/authMiddleware');

/**
 * @route   GET /api/products
 * @desc    Fetch all products (used for shop and category filters)
 * @access  Public
 */
router.get('/', getProducts);

/**
 * @route   GET /api/products/reviews/featured
 * @desc    Fetch latest reviews for home page
 * @access  Public
 */
router.get('/reviews/featured', getFeaturedReviews);

/**
 * @route   GET /api/products/reviews/my-reviews
 * @desc    Fetch logged-in user's reviews
 * @access  Private
 */
router.get('/reviews/my-reviews', protect, getUserReviews);

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

/**
 * @route   DELETE /api/products/:id/reviews/:reviewId
 * @desc    Delete a review
 * @access  Private
 */
router.delete('/:id/reviews/:reviewId', protect, deleteProductReview);

// CRITICAL: Export the router so index.js can use it
module.exports = router;