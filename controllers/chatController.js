const ChatMessage = require('../models/ChatMessage');

// @desc    Get chat history for a user
// @route   GET /api/support/chat/:userId
// @access  Private
exports.getChatHistory = async (req, res) => {
    try {
        const userId = req.params.userId || req.user._id;

        // Security: Users can only see their own chat unless admin
        if (req.user.role !== 'admin' && req.user._id.toString() !== userId.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const messages = await ChatMessage.find({ user: userId })
            .sort({ createdAt: 1 })
            .limit(100);

        res.json(messages);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch chat history' });
    }
};

// @desc    Mark messages as read
// @route   PUT /api/support/chat/read/:userId
// @access  Private
exports.markAsRead = async (req, res) => {
    try {
        const userId = req.params.userId || req.user._id;
        const isAdminAction = req.user.role === 'admin';

        await ChatMessage.updateMany(
            { 
                user: userId, 
                isAdmin: !isAdminAction, // Admin marks user messages as read, User marks admin messages as read
                isRead: false 
            },
            { $set: { isRead: true } }
        );

        res.json({ message: 'Messages marked as read' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update read status' });
    }
};

// @desc    Get active chats (Admin only)
// @route   GET /api/support/chat/admin/active
// @access  Private/Admin
exports.getActiveChats = async (req, res) => {
    try {
        const activeChats = await ChatMessage.aggregate([
            {
                $group: {
                    _id: '$user',
                    lastMessage: { $last: '$message' },
                    lastChatAt: { $last: '$createdAt' },
                    unreadCount: { 
                        $sum: { $cond: [{ $and: [{ $eq: ["$isAdmin", false] }, { $eq: ["$isRead", false] }] }, 1, 0] } 
                    }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'userInfo'
                }
            },
            { $unwind: '$userInfo' },
            {
                $project: {
                    _id: 1,
                    lastMessage: 1,
                    lastChatAt: 1,
                    unreadCount: 1,
                    user: {
                        firstName: '$userInfo.firstName',
                        lastName: '$userInfo.lastName',
                        email: '$userInfo.email',
                        chatEnabledUntil: '$userInfo.chatEnabledUntil'
                    }
                }
            },
            { $sort: { lastChatAt: -1 } }
        ]);

        res.json(activeChats);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch active chats' });
    }
};
