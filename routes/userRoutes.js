const express = require('express');
const router = express.Router();
const { toggleWishlist, addAddress, removeAddress, updateProfile, getNotifications, markNotificationRead, addCard, removeCard } = require('../controllers/userController');
const { protect, admin } = require('../middleware/authMiddleware');

// All wishlist actions require being logged in
router.post('/wishlist', protect, toggleWishlist);

// Address Book
router.post('/addresses', protect, addAddress);
router.delete('/addresses/:id', protect, removeAddress);

// Saved Cards
router.post('/cards', protect, addCard);
router.delete('/cards/:id', protect, removeCard);

// Profile
router.get('/profile', protect, require('../controllers/userController').getUserProfile); // Added Sync Route
router.put('/profile', protect, updateProfile);

// Notifications
// Notification Routes
router.get('/notifications', protect, getNotifications);
router.put('/notifications/:id/read', protect, markNotificationRead); // NEW

// --- ADMIN ROUTES ---
// We should add an 'admin' middleware check here in a real app, 
// for now we rely on the specific page logic or assume 'protect' checks token.
// TODO: Add `admin` middleware for extra security.

const userController = require('../controllers/userController');

router.get('/', protect, admin, userController.getUsers);
router.delete('/:id', protect, admin, userController.deleteUser);
router.put('/:id/role', protect, admin, userController.updateUserRole);
router.put('/:id/block', protect, admin, userController.toggleBlockUser);
router.put('/:id/permissions', protect, admin, userController.updateUserPermissions);
router.get('/logs', protect, admin, userController.getLogs);


module.exports = router;