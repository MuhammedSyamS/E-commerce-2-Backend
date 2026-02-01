const express = require('express');
const router = express.Router();
const { toggleWishlist, addAddress, removeAddress, updateProfile, getNotifications } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

// All wishlist actions require being logged in
router.post('/wishlist', protect, toggleWishlist);

// Address Book
router.post('/addresses', protect, addAddress);
router.delete('/addresses/:id', protect, removeAddress);

// Profile
router.put('/profile', protect, updateProfile);

// Notifications
router.get('/notifications', protect, getNotifications);

module.exports = router;