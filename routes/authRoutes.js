const express = require('express');
const router = express.Router();
const {
  sendOtp,
  registerUser,
  loginUser,
  refreshToken,
  logoutUser,
  forgotPasswordOtp,
  resetPassword,
  getUserProfile
} = require('../controllers/authController');

const { protect } = require('../middleware/authMiddleware');
const validate = require('../middleware/validationMiddleware');
const { registerSchema, loginSchema } = require('../utils/validations/authValidation');

const asyncHandler = require('../middleware/asyncHandler');

router.post('/send-otp', asyncHandler(sendOtp));
router.post('/register', validate(registerSchema), asyncHandler(registerUser));
router.post('/login', validate(loginSchema), asyncHandler(loginUser));
router.get('/refresh-token', asyncHandler(refreshToken));
router.post('/logout', asyncHandler(logoutUser));

// FORGOT PASSWORD FLOW
router.post('/forgot-password', asyncHandler(forgotPasswordOtp));
router.post('/reset-password', asyncHandler(resetPassword));
router.get('/profile', protect, asyncHandler(getUserProfile));

module.exports = router;
