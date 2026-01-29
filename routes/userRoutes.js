const express = require('express');
const router = express.Router();
const { toggleWishlist } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

// All wishlist actions require being logged in
router.post('/wishlist', protect, toggleWishlist);

module.exports = router;