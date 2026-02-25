const express = require('express');
const router = express.Router();
const { toggleWishlist, getWishlist } = require('../controllers/wishlistController');
const { protect } = require('../middleware/authMiddleware');

// This handles POST /api/wishlist
router.post('/', protect, toggleWishlist);

// This handles GET /api/wishlist
router.get('/', protect, getWishlist);

// Public Shared Wishlist
const { getSharedWishlist } = require('../controllers/wishlistController');
router.get('/shared/:userId', getSharedWishlist);

module.exports = router;
