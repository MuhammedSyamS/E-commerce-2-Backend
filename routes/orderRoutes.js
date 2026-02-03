const express = require('express');
const router = express.Router();
const {
  addOrderItems,
  getMyOrders,
  getOrderById,
  getAllOrders,
  getUserOrders, // New Export
  getAdminStats,
  updateOrderStatus,
  cancelOrderItem,
  deleteOrder,
  updateOrderToPaid, // New Export

  refundOrder,        // New Export
  requestReturn       // New Export
} = require('../controllers/orderController');
const { protect, admin, manager } = require('../middleware/authMiddleware');

// Matches: POST /api/orders
router.route('/').post(protect, addOrderItems);

// Matches: GET /api/orders/myorders
router.route('/myorders').get(protect, getMyOrders);

// ADMIN / MANAGER ROUTES
router.get('/admin/all', protect, manager, getAllOrders);
router.get('/admin/stats', protect, manager, getAdminStats); // Secured with manager
router.get('/user/:id', protect, manager, getUserOrders);
router.put('/:id/status', protect, manager, updateOrderStatus);

// STRICT ADMIN ROUTES (Financial/Destructive)
router.delete('/:id', protect, admin, deleteOrder);
router.put('/:id/pay', protect, admin, updateOrderToPaid);
router.put('/:id/refund', protect, admin, refundOrder);

// User Cancel Route
router.put('/:id/cancel/:itemId', protect, cancelOrderItem);

// User Return Route
router.put('/:id/return/:itemId', protect, requestReturn);

// Matches: GET /api/orders/:id (The missing route for details)
router.route('/:id').get(protect, getOrderById);

module.exports = router;