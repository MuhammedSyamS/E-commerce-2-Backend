const express = require('express');
const router = express.Router();
const {
  addOrderItems,
  getMyOrders,
  getOrderById,
  updateOrderStatus,
  getAllOrders,
  getAdminStats,
  trackOrder,
  cancelOrderItem,
  deleteOrder,
  getUserOrders,
  updateOrderToPaid,
  refundOrder,
  lookupOrder
} = require('../controllers/orderController');
const { generateInvoice, generateManifest, generateAdminReport } = require('../controllers/invoiceController');
const { protect, admin, manager, hasPermission } = require('../middleware/authMiddleware');

const validate = require('../middleware/validateMiddleware');
const { trackOrderSchema } = require('../validations/orderValidation');

const asyncHandler = require('../middleware/asyncHandler');

// Public Route
router.post('/track', validate(trackOrderSchema), asyncHandler(trackOrder));
router.get('/lookup', asyncHandler(lookupOrder));

// Matches: POST /api/orders
router.route('/').post(protect, asyncHandler(addOrderItems));

// Matches: GET /api/orders/myorders
router.route('/myorders').get(protect, asyncHandler(getMyOrders));

// ADMIN / MANAGER ROUTES
router.route('/admin/all').get(protect, hasPermission('manage_orders'), asyncHandler(getAllOrders));
router.route('/admin/stats').get(protect, hasPermission('view_stats'), asyncHandler(getAdminStats));
router.route('/user/:id').get(protect, hasPermission('manage_orders'), asyncHandler(getUserOrders));
router.put('/:id/status', protect, hasPermission('manage_orders'), asyncHandler(updateOrderStatus));

// STRICT ADMIN ROUTES (Financial/Destructive)
router.delete('/:id', protect, admin, asyncHandler(deleteOrder));
router.put('/:id/pay', protect, admin, asyncHandler(updateOrderToPaid));

// User Cancel Route
router.put('/:id/cancel/:itemId', protect, asyncHandler(cancelOrderItem));

// Invoice & Manifest Routes
router.get('/:id/invoice', protect, asyncHandler(generateInvoice));
router.get('/:id/manifest', protect, hasPermission('manage_orders'), asyncHandler(generateManifest));
router.get('/admin/report', protect, admin, asyncHandler(generateAdminReport));

// Matches: GET /api/orders/:id (Must be last to avoid catching sub-routes)
router.route('/:id').get(protect, asyncHandler(getOrderById));

module.exports = router;
