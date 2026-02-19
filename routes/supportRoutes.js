const express = require('express');
const router = express.Router();
const {
    createTicket,
    getMyTickets,
    getTicketById,
    getAllTickets,
    updateTicket,
    deleteTicket,
    submitContact
} = require('../controllers/supportController');
const { protect, admin, manager } = require('../middleware/authMiddleware');

// Public Routes
router.route('/contact').post(submitContact);

// User Routes
router.route('/').post(protect, createTicket);
router.route('/my-tickets').get(protect, getMyTickets);
router.route('/:id').get(protect, getTicketById);

// Admin Routes
router.route('/admin/all').get(protect, manager, getAllTickets); // Managers can view
router.route('/:id').put(protect, manager, updateTicket);
router.route('/:id').delete(protect, admin, deleteTicket); // Only Admin delete

module.exports = router;
