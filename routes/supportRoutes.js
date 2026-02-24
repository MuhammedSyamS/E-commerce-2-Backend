const express = require('express');
const router = express.Router();
const {
    createTicket,
    getMyTickets,
    getTicketById,
    getAllTickets,
    updateTicket,
    deleteTicket,
    submitContact,
    getAllContacts,
    updateContact,
    deleteContact,
    replyToEnquiry,
} = require('../controllers/supportController');
const { protect, admin, manager, hasPermission } = require('../middleware/authMiddleware');

// Public Routes
router.route('/contact').post(submitContact);

// User Routes
router.route('/').post(protect, createTicket);
router.route('/my-tickets').get(protect, getMyTickets);
router.route('/:id').get(protect, getTicketById);

// Admin Routes — Contacts/Enquiries
router.route('/admin/all').get(protect, hasPermission('manage_support'), getAllTickets);
router.route('/admin/contacts').get(protect, hasPermission('manage_support'), getAllContacts);
router.route('/admin/contacts/:id').put(protect, hasPermission('manage_support'), updateContact);
router.route('/admin/contacts/:id').delete(protect, admin, deleteContact);
router.route('/admin/contacts/:id/reply').post(protect, hasPermission('manage_support'), replyToEnquiry);

// Admin Routes — Tickets
router.route('/:id').put(protect, hasPermission('manage_support'), updateTicket);
router.route('/:id').delete(protect, admin, deleteTicket);

module.exports = router;
