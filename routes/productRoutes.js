const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const { 
  getProducts, getHomeProducts, getProductBySlug, createProductReview, 
  getFeaturedReviews, deleteProductReview, getUserReviews, createProduct, 
  updateProduct, deleteProduct, toggleReviewHelpful, searchProducts, 
  getRandomProducts, getRecommendations, getPublicReviews, getFilterData, 
  getProductVariants, getProductFullReviews, bulkUpdateProducts, 
  getAllReviews, getStockLogs, manualRestock, toggleReviewVisibility, 
  replyToReview, subscribeWaitlist 
} = require('../controllers/productController');
const { protect, hasPermission } = require('../middleware/authMiddleware');
const cache = require('../middleware/cacheMiddleware');
const validate = require('../middleware/validationMiddleware');
const { productSchema } = require('../utils/validations/authValidation');

router.get('/search', asyncHandler(searchProducts));
router.get('/', cache(300), asyncHandler(getProducts));
router.get('/home', cache(120), asyncHandler(getHomeProducts));
router.get('/random', asyncHandler(getRandomProducts));
router.get('/recommendations', asyncHandler(getRecommendations));
router.get('/reviews/featured', asyncHandler(getFeaturedReviews));
router.get('/reviews/all', asyncHandler(getPublicReviews));
router.get('/reviews/my-reviews', protect, asyncHandler(getUserReviews));
router.get('/filters', asyncHandler(getFilterData));
router.get('/:id/variants', asyncHandler(getProductVariants));
router.get('/:id/reviews/full', asyncHandler(getProductFullReviews));
router.get('/:slug', cache(300), asyncHandler(getProductBySlug));

router.post('/', protect, hasPermission('manage_products'), validate(productSchema), asyncHandler(createProduct));
router.put('/bulk-update', protect, hasPermission('manage_products'), asyncHandler(bulkUpdateProducts));
router.put('/:id', protect, hasPermission('manage_products'), asyncHandler(updateProduct));
router.delete('/:id', protect, hasPermission('manage_products'), asyncHandler(deleteProduct));
router.get('/admin/reviews', protect, hasPermission('manage_reviews'), asyncHandler(getAllReviews));
router.get('/:id/stock-logs', protect, hasPermission('manage_products'), asyncHandler(getStockLogs));
router.post('/:id/stock', protect, hasPermission('manage_products'), asyncHandler(manualRestock));

router.post('/:id/reviews', protect, asyncHandler(createProductReview));
router.delete('/:id/reviews/:reviewId', protect, asyncHandler(deleteProductReview));
router.put('/:id/reviews/:reviewId/toggle', protect, hasPermission('manage_reviews'), asyncHandler(toggleReviewVisibility));
router.put('/:id/reviews/:reviewId/reply', protect, hasPermission('manage_reviews'), asyncHandler(replyToReview));
router.put('/:id/reviews/:reviewId/helpful', protect, asyncHandler(toggleReviewHelpful));
router.post('/:id/waitlist', asyncHandler(subscribeWaitlist));

module.exports = router;
