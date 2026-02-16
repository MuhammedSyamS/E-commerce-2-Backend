const Ticket = require('../models/Ticket');
const User = require('../models/User');

// @desc    Create a new support ticket
// @route   POST /api/support
// @access  Private
exports.createTicket = async (req, res) => {
    try {
        const { subject, message, priority } = req.body;

        if (!subject || !message) {
            return res.status(400).json({ message: 'Please add subject and message' });
        }

        const ticket = await Ticket.create({
            user: req.user._id,
            subject,
            message,
            priority: priority || 'Medium',
            status: 'Open',
            isReadByUser: true,
            isReadByAdmin: false
        });

        res.status(201).json(ticket);
    } catch (error) {
        res.status(500).json({ message: 'Failed to create ticket' });
    }
};

// @desc    Get user tickets
// @route   GET /api/support/my-tickets
// @access  Private
exports.getMyTickets = async (req, res) => {
    try {
        const tickets = await Ticket.find({ user: req.user._id }).sort({ createdAt: -1 });
        res.json(tickets);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch tickets' });
    }
};

// @desc    Get single ticket
// @route   GET /api/support/:id
// @access  Private
exports.getTicketById = async (req, res) => {
    try {
        const ticket = await Ticket.findById(req.params.id);

        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found' });
        }

        if (ticket.user.toString() !== req.user._id.toString() && req.user.role !== 'admin' && req.user.role !== 'manager') {
            return res.status(401).json({ message: 'Not authorized' });
        }

        res.json(ticket);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch ticket' });
    }
};

// @desc    Get all tickets (Admin)
// @route   GET /api/support/admin/all
// @access  Private/Admin
exports.getAllTickets = async (req, res) => {
    try {
        const tickets = await Ticket.find({})
            .populate('user', 'firstName lastName email')
            .sort({ createdAt: -1 });
        res.json(tickets);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch all tickets' });
    }
};

// @desc    Update ticket (Admin Reply / Status Change)
// @route   PUT /api/support/:id
// @access  Private/Admin
exports.updateTicket = async (req, res) => {
    try {
        const ticket = await Ticket.findById(req.params.id);

        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found' });
        }

        const { status, adminResponse } = req.body;

        if (status) ticket.status = status;
        if (adminResponse) {
            ticket.adminResponse = adminResponse;
            ticket.isReadByUser = false;
        }

        // If admin opens it, mark as read by admin
        ticket.isReadByAdmin = true;

        const updatedTicket = await ticket.save();
        res.json(updatedTicket);
    } catch (error) {
        res.status(500).json({ message: 'Update failed' });
    }
};

// @desc    Delete ticket
// @route   DELETE /api/support/:id
// @access  Private/Admin
exports.deleteTicket = async (req, res) => {
    try {
        const ticket = await Ticket.findById(req.params.id);
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        await ticket.deleteOne();
        res.json({ message: 'Ticket removed' });
    } catch (error) {
        res.status(500).json({ message: 'Delete failed' });
    }
};
