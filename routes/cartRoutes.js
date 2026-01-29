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

// Matches DELETE /api/cart/remove/:id
router.delete('/remove/:id', protect, removeFromCart);

// Matches DELETE /api/cart/clear
router.delete('/clear', protect, clearCart);

module.exports = router;