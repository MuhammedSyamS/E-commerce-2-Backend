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
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/').post(protect, createReturnRequest);
router.route('/my').get(protect, getMyReturns);
router.route('/admin').get(protect, admin, getAllReturns);
router.route('/:id').get(protect, getReturnById);
router.route('/:id/status').put(protect, admin, updateReturnStatus);
router.route('/:id/resolve').put(protect, admin, resolveReturn);

module.exports = router;
