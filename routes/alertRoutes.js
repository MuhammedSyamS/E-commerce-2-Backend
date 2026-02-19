const express = require('express');
const router = express.Router();
const Alert = require('../models/Alert');
const { protect, manager } = require('../middleware/authMiddleware');

// @desc    Get all system alerts
// @route   GET /api/alerts
// @access  Private/Manager
router.get('/', protect, manager, async (req, res) => {
    try {
        const alerts = await Alert.find({ isRead: false }).sort({ createdAt: -1 });
        res.json(alerts);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Mark alert as read
// @route   PUT /api/alerts/:id/read
// @access  Private/Manager
router.put('/:id/read', protect, manager, async (req, res) => {
    try {
        const alert = await Alert.findById(req.params.id);
        if (alert) {
            alert.isRead = true;
            await alert.save();
            res.json({ message: 'Alert marked as read' });
        } else {
            res.status(404).json({ message: 'Alert not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @desc    Clear all alerts
// @route   DELETE /api/alerts
// @access  Private/Manager
router.delete('/', protect, manager, async (req, res) => {
    try {
        await Alert.updateMany({ isRead: false }, { $set: { isRead: true } });
        res.json({ message: 'All alerts cleared' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
