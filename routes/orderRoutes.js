const express = require('express');
const router = express.Router();
const { addOrderItems, getMyOrders } = require('../controllers/orderController');
const { protect } = require('../middleware/authMiddleware');

// Matches POST /api/orders
router.route('/').post(protect, addOrderItems);

// Matches GET /api/orders/myorders
router.route('/myorders').get(protect, getMyOrders);

module.exports = router;