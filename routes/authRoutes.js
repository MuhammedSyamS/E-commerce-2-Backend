const express = require('express');
const router = express.Router();
const {
  sendOtp,
  registerUser,
  loginUser,
  forgotPasswordOtp,
  resetPassword,
  getUserProfile
} = require('../controllers/authController');

const { protect } = require('../middleware/authMiddleware');

router.post('/send-otp', sendOtp);
router.post('/register', registerUser);
router.post('/login', loginUser);

// SYNC ROUTE
router.get('/profile', protect, getUserProfile);

// FORGOT PASSWORD FLOW
router.post('/forgot-password', forgotPasswordOtp);
router.post('/reset-password', resetPassword);

module.exports = router;