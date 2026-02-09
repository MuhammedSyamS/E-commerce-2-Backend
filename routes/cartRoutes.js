const express = require('express');
const router = express.Router();

// Ensure these names match the controller exactly
const {
  addToCart,
  decreaseQuantity,
  removeFromCart,
  clearCart
} = require('../controllers/cartController');

const { protect } = require('../middleware/authMiddleware');

// Matches POST /api/cart/add
router.post('/add', protect, addToCart);

// Matches POST /api/cart/decrease
router.post('/decrease', protect, decreaseQuantity);

// Matches POST /api/cart/remove (Changed from DELETE to POST for body payload)
router.post('/remove', protect, removeFromCart);

// Matches DELETE /api/cart/clear
router.delete('/clear', protect, clearCart);

module.exports = router;