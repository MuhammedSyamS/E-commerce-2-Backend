const express = require('express');
const router = express.Router();
const { generateInvoice } = require('../controllers/invoiceController');
const { protect } = require('../middleware/authMiddleware');

router.get('/:id/invoice', protect, generateInvoice);

module.exports = router;
