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
  updateOrderToPaid,
  trackOrder,
  lookupOrder
} = require('../controllers/orderController');
const { generateInvoice, generateManifest } = require('../controllers/invoiceController');
const { protect, admin, manager, hasPermission } = require('../middleware/authMiddleware');

// Public Route
router.post('/track', trackOrder);
router.get('/lookup', lookupOrder);

// Matches: POST /api/orders
router.route('/').post(protect, addOrderItems);

// Matches: GET /api/orders/myorders
router.route('/myorders').get(protect, getMyOrders);

// ADMIN / MANAGER ROUTES
router.route('/admin/all').get(protect, hasPermission('manage_orders'), getAllOrders);
router.route('/admin/stats').get(protect, hasPermission('view_stats'), getAdminStats);
router.route('/user/:id').get(protect, hasPermission('manage_orders'), getUserOrders);
router.put('/:id/status', protect, hasPermission('manage_orders'), updateOrderStatus);

// STRICT ADMIN ROUTES (Financial/Destructive)
router.delete('/:id', protect, admin, deleteOrder);
router.put('/:id/pay', protect, admin, updateOrderToPaid);

// User Cancel Route
router.put('/:id/cancel/:itemId', protect, cancelOrderItem);

// Invoice & Manifest Routes
router.get('/:id/invoice', protect, generateInvoice);
router.get('/:id/manifest', protect, hasPermission('manage_orders'), generateManifest);

// Matches: GET /api/orders/:id (Must be last to avoid catching sub-routes)
router.route('/:id').get(protect, getOrderById);

module.exports = router;
