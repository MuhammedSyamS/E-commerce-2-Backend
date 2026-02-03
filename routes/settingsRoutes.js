const express = require('express');
const router = express.Router();
const { getSettings, updateSettings } = require('../controllers/settingsController');
const { protect, admin } = require('../middleware/authMiddleware');

router.get('/', getSettings); // Public
router.put('/', protect, admin, updateSettings); // Admin

module.exports = router;
