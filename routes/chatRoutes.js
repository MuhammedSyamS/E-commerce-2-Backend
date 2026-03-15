const express = require('express');
const router = express.Router();
const { getChatHistory, markAsRead, getActiveChats } = require('../controllers/chatController');
const { protect, admin } = require('../middleware/authMiddleware');

router.get('/history', protect, getChatHistory);
router.get('/history/:userId', protect, getChatHistory);
router.put('/read', protect, markAsRead);
router.put('/read/:userId', protect, markAsRead);
router.get('/active', protect, admin, getActiveChats);

module.exports = router;
