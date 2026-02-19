const express = require('express');
const router = express.Router();
const {
    createReturnRequest,
    getAllReturns,
    getMyReturns,
    getReturnById,
    updateReturnStatus,
    resolveReturn
} = require('../controllers/returnController');
const { protect, admin, manager } = require('../middleware/authMiddleware');

router.route('/').post(protect, createReturnRequest);
router.get('/track/:id', require('../controllers/returnController').trackReturn); // Public endpoint
router.route('/my').get(protect, getMyReturns);
router.route('/admin').get(protect, manager, getAllReturns);
router.route('/:id').get(protect, getReturnById);
router.route('/:id/status').put(protect, manager, updateReturnStatus);
router.route('/:id/resolve').put(protect, manager, resolveReturn);

module.exports = router;
