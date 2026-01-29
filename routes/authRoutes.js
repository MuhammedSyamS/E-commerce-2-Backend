const express = require('express');
const router = express.Router();
const { 
  sendOtp, 
  registerUser, 
  loginUser,
  forgotPasswordOtp,
  resetPassword 
} = require('../controllers/authController');

router.post('/send-otp', sendOtp);
router.post('/register', registerUser);
router.post('/login', loginUser);

// FORGOT PASSWORD FLOW
router.post('/forgot-password', forgotPasswordOtp);
router.post('/reset-password', resetPassword);

module.exports = router;