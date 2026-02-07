const express = require('express');
const router = express.Router();
const {
  addOrderItems,
  getMyOrders,
  getOrderById,
  getAllOrders,
  getUserOrders,
  getAdminStats,
  updateOrderStatus,
  cancelOrderItem,
  deleteOrder,
  updateOrderToPaid
} = require('../controllers/orderController');
const { generateInvoice } = require('../controllers/invoiceController');
const { protect, admin, manager } = require('../middleware/authMiddleware');

// Matches: POST /api/orders
router.route('/').post(protect, addOrderItems);

// Matches: GET /api/orders/myorders
router.route('/myorders').get(protect, getMyOrders);

// ADMIN / MANAGER ROUTES
router.route('/admin/all').get(protect, admin, getAllOrders);
router.route('/admin/stats').get(protect, admin, getAdminStats);
router.route('/user/:id').get(protect, admin, getUserOrders);
router.put('/:id/status', protect, manager, updateOrderStatus);

// STRICT ADMIN ROUTES (Financial/Destructive)
router.delete('/:id', protect, admin, deleteOrder);
router.put('/:id/pay', protect, admin, updateOrderToPaid);

// User Cancel Route
router.put('/:id/cancel/:itemId', protect, cancelOrderItem);

// Invoice Route (Must be before Generic ID)
router.get('/:id/invoice', protect, generateInvoice);

// Matches: GET /api/orders/:id (Must be last to avoid catching sub-routes)
router.route('/:id').get(protect, getOrderById);

module.exports = router;