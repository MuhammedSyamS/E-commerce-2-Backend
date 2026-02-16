const express = require('express');
const router = express.Router();
const { getFashionAdvice } = require('../controllers/aiController');

router.post('/stylist', getFashionAdvice);

module.exports = router;
