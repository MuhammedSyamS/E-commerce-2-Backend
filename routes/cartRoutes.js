const express = require('express');
const router = express.Router();

// Ensure these names match the controller exactly
const {
  addToCart,
  decreaseQuantity,
  removeFromCart,
  clearCart,
  saveForLater,
  moveToCart
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

// Matches POST /api/cart/save
router.post('/save', protect, saveForLater);

// Matches POST /api/cart/move-to-cart
router.post('/move-to-cart', protect, moveToCart);

module.exports = router;
