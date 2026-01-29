const express = require('express');
const router = express.Router();
const { 
  addOrderItems, 
  getMyOrders, 
  getOrderById // 1. Make sure this is imported
} = require('../controllers/orderController');
const { protect } = require('../middleware/authMiddleware');

// Matches: POST /api/orders
router.route('/').post(protect, addOrderItems);

// Matches: GET /api/orders/myorders
router.route('/myorders').get(protect, getMyOrders);

// Matches: GET /api/orders/:id (The missing route for details)
router.route('/:id').get(protect, getOrderById); 

module.exports = router;