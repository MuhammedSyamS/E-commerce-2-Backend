const express = require('express');
const router = express.Router();
const multer = require('multer');
const userController = require('../controllers/userController');
const { protect, admin, hasPermission } = require('../middleware/authMiddleware');

// All wishlist actions require being logged in
router.post('/wishlist', protect, userController.toggleWishlist);
router.post('/wishlist/bulk', protect, userController.bulkWishlist);
router.get('/wishlist', protect, userController.getWishlist);

// Address Book
router.post('/addresses', protect, userController.addAddress);
router.delete('/addresses/:id', protect, userController.removeAddress);

// Saved Cards
router.post('/cards', protect, userController.addCard);
router.delete('/cards/:id', protect, userController.removeCard);

// Profile
router.put('/profile', protect, userController.updateProfile);
router.post('/profile/avatar', protect, multer({ storage: multer.memoryStorage() }).single('file'), userController.updateAvatar);
router.get('/referrals', protect, userController.getReferralStats);
router.get('/loyalty-history', protect, userController.getLoyaltyHistory);

// History (AI)
router.post('/history', protect, userController.recordView);
router.get('/recently-viewed', protect, userController.getRecentlyViewed);

// Social Login
router.post('/google-login', userController.googleLogin);

// Notifications
// Notification Routes
router.get('/notifications', protect, userController.getNotifications);
router.put('/notifications/:id/read', protect, userController.markNotificationRead); // NEW

// OTP Routes for Security
router.post('/security/send-otp', protect, userController.sendOTP);
router.post('/verify-otp', protect, userController.verifyOTP);

// --- ADMIN ROUTES ---
// We should add an 'admin' middleware check here in a real app, 
// for now we rely on the specific page logic or assume 'protect' checks token.
// TODO: Add `admin` middleware for extra security.


router.get('/', protect, hasPermission('manage_users'), userController.getUsers);
router.delete('/:id', protect, hasPermission('manage_users'), userController.deleteUser);
router.put('/:id/role', protect, hasPermission('manage_users'), userController.updateUserRole);
router.put('/:id/block', protect, hasPermission('manage_users'), userController.toggleBlockUser);
router.put('/:id/permissions', protect, hasPermission('manage_users'), userController.updateUserPermissions);
router.get('/logs', protect, hasPermission('manage_users'), userController.getLogs);

// Abandoned Cart Management
router.get('/admin/abandoned-carts', protect, admin, userController.getAbandonedCarts);
router.post('/admin/nudge/:id', protect, admin, userController.sendCartNudge);


module.exports = router;
