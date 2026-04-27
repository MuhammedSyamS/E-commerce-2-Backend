const express = require('express');
const router = express.Router();
const webpush = require('web-push');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { protect, admin } = require('../middleware/authMiddleware');

// CONFIGURE VAPID KEYS
const publicVapidKey = process.env.VAPID_PUBLIC_KEY;
const privateVapidKey = process.env.VAPID_PRIVATE_KEY;

if (!publicVapidKey || !privateVapidKey) {
    console.error("VAPID KEYS MISSING IN ENV");
} else {
    webpush.setVapidDetails('mailto:admin@slook.com', publicVapidKey, privateVapidKey);
}

// 1. Subscribe User to Push
router.post('/subscribe', protect, async (req, res) => {
    try {
        const subscription = req.body;
        console.log("SUBSCRIBE ENDPOINT HIT:", req.user?._id, subscription); // DEBUG
        
        if (!subscription || !subscription.endpoint) {
            return res.status(400).json({ message: 'Invalid subscription data' });
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.pushSubscription = subscription;
        const savedUser = await user.save();
        console.log("SUBSCRIPTION SAVED DB:", savedUser.pushSubscription ? 'YES' : 'NO'); // DEBUG
        res.status(201).json({ message: 'Push Subscription Saved' });
    } catch (error) {
        console.error("PUSH SUBSCRIBE ERROR:", {
            message: error.message,
            stack: error.stack,
            userId: req.user?._id,
            body: req.body
        });
        res.status(500).json({ message: 'Failed to save subscription', error: error.message });
    }
});

// 2. Get User Notifications (History)
router.get('/', protect, async (req, res) => {
    const notifications = await Notification.find({
        $or: [{ user: req.user._id }, { user: null }] // User-specific or Global
    }).sort({ createdAt: -1 }).limit(20);
    res.json(notifications);
});

// 3. Admin Send Push (Manual Test)
router.post('/send', protect, admin, async (req, res) => {
    const { title, message } = req.body;

    // Save to DB (Global)
    await Notification.create({ title, message, type: 'system' });

    // Find users with active subscriptions
    const users = await User.find({ 'pushSubscription.endpoint': { $exists: true } });
    const payload = JSON.stringify({ title, body: message });

    let sentCount = 0;
    let failedCount = 0;

    await Promise.all(users.map(async (u) => {
        try {
            await webpush.sendNotification(u.pushSubscription, payload);
            sentCount++;
        } catch (err) {
            // Remove invalid/expired subscriptions (404 Not Found or 410 Gone)
            if (err.statusCode === 404 || err.statusCode === 410) {
                u.pushSubscription = undefined;
                await u.save();
                failedCount++;
            }
        }
    }));

    res.json({ message: `Push sent to ${sentCount} devices. Removed ${failedCount} stale subscriptions.` });
});

// 4. Mark Single Notification as Read
router.put('/:id/read', protect, async (req, res) => {
    const notif = await Notification.findById(req.params.id);
    if (notif) {
        notif.isRead = true;
        await notif.save();
        res.json({ message: 'Marked as read' });
    } else {
        res.status(404).json({ message: 'Notification not found' });
    }
});

// 5. Mark ALL as Read
router.put('/read-all', protect, async (req, res) => {
    await Notification.updateMany({ user: req.user._id, isRead: false }, { isRead: true });
    res.json({ message: 'All marked as read' });
});

module.exports = router;
