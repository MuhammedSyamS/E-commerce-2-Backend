const express = require('express');
const router = express.Router();
const { 
  addToCart, 
  removeFromCart, 
  decreaseQuantity, 
  clearCart 
} = require('../controllers/cartController');
const { protect } = require('../middleware/authMiddleware');

// Route: POST /api/cart/add
// Desc: Add item or increase quantity
router.post('/add', protect, addToCart);

// Route: POST /api/cart/decrease
// Desc: Lower quantity by 1 (removes item if quantity becomes 0)
router.post('/decrease', protect, decreaseQuantity);

// Route: DELETE /api/cart/remove/:id
// Desc: Remove specific product from cart entirely
router.delete('/remove/:id', protect, removeFromCart);

// Route: DELETE /api/cart/clear
// Desc: Remove all items from the user's cart
router.delete('/clear', protect, clearCart);

module.exports = router;