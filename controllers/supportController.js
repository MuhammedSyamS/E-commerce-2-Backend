const Contact = require('../models/Contact');
const Ticket = require('../models/Ticket');
const User = require('../models/User');

// @desc    Submit Public Contact Form
// @route   POST /api/support/contact
// @access  Public
exports.submitContact = async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;

        if (!name || !email || !message) {
            return res.status(400).json({ message: 'Please fill in all fields' });
        }

        const contact = await Contact.create({
            name,
            email,
            subject,
            message
        });

        // NOTIFY ADMINS (Async)
        const Notification = require('../models/Notification');
        User.find({ role: 'admin' }).then(adminUsers => {
            adminUsers.forEach(admin => {
                Notification.create({
                    user: admin._id,
                    title: "New Enquiry",
                    message: `New message from ${name}: ${subject}`,
                    type: 'system',
                    data: { url: '/admin/support' }
                }).catch(err => console.error("Admin Notif Error:", err));
            });
        }).catch(err => console.error("Admin Fetch Error:", err));

        const io = req.app.get('socketio');
        if (io) {
            io.emit('new-contact', { name, email, subject });
        }

        res.status(201).json({ message: 'Message sent successfully! We will contact you soon.', id: contact._id });
    } catch (error) {
        console.error("Contact Submit Error:", error);
        res.status(500).json({ message: 'Failed to send message' });
    }
};

// @desc    Get All Contact Inquiries (Admin)
// @route   GET /api/support/admin/contacts
// @access  Private/Admin
exports.getAllContacts = async (req, res) => {
    try {
        const contacts = await Contact.find({}).sort({ createdAt: -1 });
        res.json(contacts);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch contacts' });
    }
};

// @desc    Update Contact Status (Admin)
// @route   PUT /api/support/admin/contacts/:id
// @access  Private/Admin
exports.updateContact = async (req, res) => {
    try {
        const contact = await Contact.findById(req.params.id);
        if (!contact) return res.status(404).json({ message: 'Enquiry not found' });

        const { status } = req.body;
        if (status) contact.status = status;
        contact.readByAdmin = true;
        await contact.save();
        res.json(contact);
    } catch (error) {
        res.status(500).json({ message: 'Failed to update enquiry' });
    }
};

// @desc    Delete a Contact (Admin)
// @route   DELETE /api/support/admin/contacts/:id
// @access  Private/Admin
exports.deleteContact = async (req, res) => {
    try {
        const contact = await Contact.findById(req.params.id);
        if (!contact) return res.status(404).json({ message: 'Enquiry not found' });
        await contact.deleteOne();
        res.json({ message: 'Enquiry deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete enquiry' });
    }
};



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

        // NOTIFY ADMINS (Async)
        const Notification = require('../models/Notification');
        User.find({ role: 'admin' }).then(adminUsers => {
            adminUsers.forEach(admin => {
                Notification.create({
                    user: admin._id,
                    title: "New Support Ticket",
                    message: `${req.user.firstName} submitted a ticket: ${subject}`,
                    type: 'system',
                    data: { url: '/admin/support' }
                }).catch(err => console.error("Admin Notif Error:", err));
            });
        }).catch(err => console.error("Admin Fetch Error:", err));

        const io = req.app.get('socketio');
        if (io) {
            io.emit('new-ticket', {
                subject,
                user: { firstName: req.user.firstName, lastName: req.user.lastName }
            });
        }

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

        // AUTO-READ: If owner opens it, mark as read
        if (ticket.user.toString() === req.user._id.toString() && !ticket.isReadByUser) {
            ticket.isReadByUser = true;
            await ticket.save();
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
        const ticket = await Ticket.findById(req.params.id).populate('user', 'firstName email');

        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found' });
        }

        const { status, adminResponse } = req.body;

        if (status) ticket.status = status;
        if (adminResponse) {
            ticket.adminResponse = adminResponse;
            ticket.isReadByUser = false;
        }

        // Apply admin read state
        ticket.isReadByAdmin = true;

        const updatedTicket = await ticket.save();
        res.json(updatedTicket);

        // --- BACKGROUND PROCESSING (Non-blocking) ---
        if (adminResponse) {
            try {
                const nodemailer = require('nodemailer');
                const supportPass = process.env.SUPPORT_EMAIL_PASS;
                const isPlaceholder = !supportPass || supportPass.startsWith('REPLACE_WITH');
                const senderEmail = isPlaceholder ? process.env.EMAIL_USER : (process.env.SUPPORT_EMAIL || process.env.EMAIL_USER);
                const senderPass = isPlaceholder ? process.env.EMAIL_PASS : (process.env.SUPPORT_EMAIL_PASS || process.env.EMAIL_PASS);

                if (senderEmail && senderPass) {
                    const transporter = nodemailer.createTransport({
                        service: 'gmail',
                        host: 'smtp.gmail.com',
                        port: 587,
                        secure: false,
                        auth: { user: senderEmail, pass: senderPass },
                        tls: { rejectUnauthorized: false },
                    });

                    const html = `
                        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;border:1px solid #e4e4e7;border-radius:12px;">
                            <div style="background:#18181b;padding:20px 24px;border-radius:8px;margin-bottom:24px;">
                                <h1 style="color:#fff;margin:0;font-size:22px;letter-spacing:-0.5px;">SLOOK</h1>
                                <p style="color:#71717a;margin:4px 0 0;font-size:12px;">Support Ticket Update</p>
                            </div>
                            <p style="color:#3f3f46;font-size:15px;margin-bottom:8px;">Hi <strong>${ticket.user?.firstName || 'Customer'}</strong>,</p>
                            <p style="color:#3f3f46;font-size:14px;margin-bottom:20px;">
                                An administrator has responded to your support ticket regarding: 
                                <strong>"${ticket.subject}"</strong>.
                            </p>
                            <div style="background:#fdfcfb;border-left:4px solid #000;padding:16px 20px;border-radius:0 8px 8px 0;margin-bottom:24px;">
                                <p style="color:#09090b;font-size:14px;line-height:1.7;white-space:pre-wrap;margin:0;">${adminResponse}</p>
                            </div>
                            <p style="color:#71717a;font-size:13px;margin-bottom:20px;">
                                You can view the full ticket and continue the conversation in your account dashboard.
                            </p>
                            <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/account" 
                               style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold;font-size:13px;">
                               View My Account
                            </a>
                            <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0;" />
                            <p style="color:#a1a1aa;font-size:11px;margin:0;">SLOOK &mdash; Luxury Fashion Support</p>
                        </div>
                    `;

                    transporter.sendMail({
                        from: `"SLOOK Support" <${senderEmail}>`,
                        to: ticket.user.email,
                        subject: `Update on Ticket: ${ticket.subject}`,
                        html,
                    }).catch(err => console.error("❌ Ticket Mail Error Delay:", err.message));
                    console.log(`✅ Ticket Email Sent to: ${ticket.user.email}`);
                }
            } catch (mailErr) {
                console.error("❌ Ticket Mail Error:", mailErr.message);
                // We don't fail the request if email fails, but we log it
            }

            // --- REAL-TIME NOTIFICATION & SOCKET ---
            try {
                const Notification = require('../models/Notification');
                Notification.create({
                    user: ticket.user._id,
                    title: "Ticket Update",
                    message: `An administrator has responded to your ticket: ${ticket.subject}`,
                    type: 'system',
                    data: { url: '/support', ticketId: ticket._id }
                }).then(notification => {
                    const io = req.app.get('socketio');
                    if (io) {
                        io.to(ticket.user._id.toString()).emit('notification', notification);
                    }
                }).catch(err => console.error("User Notif Error:", err));

                // UNLOCK CHAT FOR 5 MINUTES
                const User = require('../models/User');
                User.findByIdAndUpdate(ticket.user._id, {
                    chatEnabledUntil: new Date(Date.now() + 5 * 60 * 1000)
                }).then(() => {
                    const io = req.app.get('socketio');
                    if (io) {
                        io.to(ticket.user._id.toString()).emit('chat-enabled', {
                            enabledUntil: new Date(Date.now() + 5 * 60 * 1000)
                        });
                    }
                }).catch(err => console.error("Chat Unlock Error:", err));

                const io = req.app.get('socketio');
                if (io) {
                    io.to(ticket.user._id.toString()).emit('ticket-reply', {
                        ticketId: ticket._id,
                        subject: ticket.subject,
                        message: adminResponse,
                        chatEnabledUntil: new Date(Date.now() + 5 * 60 * 1000)
                    });
                }
            } catch (notifErr) {
                console.error("❌ Notification Error:", notifErr.message);
            }
        }
    } catch (error) {
        console.error("Ticket Update Error:", error);
        res.status(500).json({ message: error.message || 'Update failed' });
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

// @desc    Reply to a Contact Enquiry via Email
// @route   POST /api/support/admin/contacts/:id/reply
// @access  Private/Admin
exports.replyToEnquiry = async (req, res) => {
    try {
        const contact = await Contact.findById(req.params.id);
        if (!contact) return res.status(404).json({ message: 'Enquiry not found' });

        const { replyMessage } = req.body;
        if (!replyMessage?.trim()) return res.status(400).json({ message: 'Reply message is required' });

        const nodemailer = require('nodemailer');

        // Detect if SUPPORT_EMAIL_PASS is still a placeholder — fall back to verified EMAIL credentials
        const supportPass = process.env.SUPPORT_EMAIL_PASS;
        const isPlaceholder = !supportPass || supportPass.startsWith('REPLACE_WITH');

        // Use SUPPORT_EMAIL account if properly configured, otherwise fall back to EMAIL_USER
        const senderEmail = isPlaceholder ? process.env.EMAIL_USER : (process.env.SUPPORT_EMAIL || process.env.EMAIL_USER);
        const senderPass = isPlaceholder ? process.env.EMAIL_PASS : (process.env.SUPPORT_EMAIL_PASS || process.env.EMAIL_PASS);

        if (!senderEmail || !senderPass) {
            return res.status(500).json({ message: 'Email credentials not configured on server' });
        }

        console.log(`[REPLY] Sending via: ${senderEmail} (support configured: ${!isPlaceholder})`);

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            auth: { user: senderEmail, pass: senderPass },
            tls: { rejectUnauthorized: false },
        });

        // Verify SMTP connection before sending
        try {
            await transporter.verify();
        } catch (verifyErr) {
            console.error('[REPLY SMTP VERIFY FAILED]', verifyErr.message);
            return res.status(500).json({ message: `SMTP auth failed: ${verifyErr.message}` });
        }

        const html = `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;border:1px solid #e4e4e7;border-radius:12px;">
                <div style="background:#18181b;padding:20px 24px;border-radius:8px;margin-bottom:24px;">
                    <h1 style="color:#fff;margin:0;font-size:22px;letter-spacing:-0.5px;">SLOOK</h1>
                    <p style="color:#71717a;margin:4px 0 0;font-size:12px;">Customer Support</p>
                </div>
                <p style="color:#3f3f46;font-size:15px;margin-bottom:8px;">Hi <strong>${contact.name}</strong>,</p>
                <p style="color:#3f3f46;font-size:14px;margin-bottom:20px;">
                    Thank you for reaching out. Here's our reply to your enquiry regarding
                    <strong>"${contact.subject || 'your message'}"</strong>:
                </p>
                <div style="background:#fafafa;border-left:4px solid #7c3aed;padding:16px 20px;border-radius:0 8px 8px 0;margin-bottom:24px;">
                    <p style="color:#09090b;font-size:14px;line-height:1.7;white-space:pre-wrap;margin:0;">${replyMessage}</p>
                </div>
                <p style="color:#71717a;font-size:13px;margin-bottom:4px;">
                    If you have further questions, feel free to reply to this email or write to us at
                    <a href="mailto:${senderEmail}" style="color:#7c3aed;">${senderEmail}</a>.
                </p>
                <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0;" />
                <p style="color:#a1a1aa;font-size:11px;margin:0;">SLOOK &mdash; Luxury Fashion</p>
            </div>
        `;

        // Send Email (Non-blocking)
        transporter.sendMail({
            from: `"SLOOK Support" <${senderEmail}>`,
            to: contact.email,
            subject: `Re: ${contact.subject || 'Your Enquiry'} – SLOOK Support`,
            html,
            text: replyMessage,
        }).catch(err => console.error('[SMTP EMAIL ERROR]', err.message));

        // Persist reply + mark as Replied
        contact.adminReply = replyMessage;
        contact.status = 'Replied';
        contact.readByAdmin = true;
        await contact.save();

        // --- REAL-TIME NOTIFICATION & SOCKET (Non-blocking) ---
        User.findOne({ email: contact.email }).then(registeredUser => {
            if (registeredUser) {
                const Notification = require('../models/Notification');
                Notification.create({
                    user: registeredUser._id,
                    title: "Inquiry Replied",
                    message: `We've responded to your inquiry: ${contact.subject || 'your message'}`,
                    type: 'system',
                    data: { url: '/support' }
                }).then(notification => {
                    const io = req.app.get('socketio');
                    if (io) {
                        io.to(registeredUser._id.toString()).emit('notification', notification);
                    }
                }).catch(err => console.error("❌ Contact Notif Error:", err));
            }
        }).catch(err => console.error("❌ Registered User Fetch Error:", err));

        res.json({ message: 'Reply sent successfully', contact });
    } catch (error) {
        console.error('[ENQUIRY REPLY ERROR]', error.message);
        res.status(500).json({ message: error.message || 'Failed to send reply' });
    }
};
