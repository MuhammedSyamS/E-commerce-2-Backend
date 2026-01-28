const express = require('express');
const router = express.Router();
const { toggleWishlist, getWishlist } = require('../controllers/WishlistController');
const { protect } = require('../middleware/authMiddleware');

// This handles POST /api/wishlist
router.post('/', protect, toggleWishlist); 

// This handles GET /api/wishlist
router.get('/', protect, getWishlist);

module.exports = router;