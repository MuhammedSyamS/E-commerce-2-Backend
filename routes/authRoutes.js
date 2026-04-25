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

router.post('/send-otp', sendOtp);
router.post('/register', validate(registerSchema), registerUser);
router.post('/login', validate(loginSchema), loginUser);
router.post('/refresh', refreshToken);
router.post('/logout', logoutUser);

// FORGOT PASSWORD FLOW
router.post('/forgot-password', forgotPasswordOtp);
router.post('/reset-password', resetPassword);

module.exports = router;
