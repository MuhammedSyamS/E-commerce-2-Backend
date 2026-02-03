const express = require('express');
const router = express.Router();

// Import your controller functions
const {
  getProducts,
  getProductBySlug,
  createProductReview,
  getFeaturedReviews,
  deleteProductReview,
  getUserReviews,
  createProduct,
  updateProduct,
  deleteProduct
} = require('../controllers/productController');

// Import your authentication middleware
const { protect, admin, manager } = require('../middleware/authMiddleware');

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
 * @desc    Fetch single product by slug or ID
 * @access  Public
 */
router.get('/:slug', getProductBySlug);

// ADMIN / MANAGER ROUTES
/**
 * @route   POST /api/products
 * @desc    Create a new product
 * @access  Private/Admin/Manager
 */
router.post('/', protect, manager, createProduct);

/**
 * @route   PUT /api/products/:id
 * @desc    Update a product
 * @access  Private/Admin/Manager
 */
router.put('/:id', protect, manager, updateProduct);

/**
 * @route   DELETE /api/products/:id
 * @desc    Delete a product
 * @access  Private/Admin/Manager
 */
router.delete('/:id', protect, manager, deleteProduct);

/**
 * @route   GET /api/products/admin/reviews
 * @desc    Get all reviews for moderation
 * @access  Private/Admin/Manager
 */
router.get('/admin/reviews', protect, manager, require('../controllers/productController').getAllReviews);

// REVIEWS (User)
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
router.put('/:id/reviews/:reviewId/toggle', protect, manager, require('../controllers/productController').toggleReviewVisibility);
router.put('/:id/reviews/:reviewId/reply', protect, manager, require('../controllers/productController').replyToReview);

module.exports = router;