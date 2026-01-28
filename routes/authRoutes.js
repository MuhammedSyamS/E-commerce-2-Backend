const express = require('express');
const router = express.Router();
const { 
  sendOtp, 
  registerUser, 
  loginUser 
} = require('../controllers/authController');

// @route   POST /api/auth/send-otp
// @desc    Check if user exists and send a 6-digit code
router.post('/send-otp', sendOtp);

// @route   POST /api/auth/register
// @desc    Verify the OTP and save the user to MongoDB
router.post('/register', registerUser);

// @route   POST /api/auth/login
// @desc    Authenticate user and return JWT token
router.post('/login', loginUser);

module.exports = router;