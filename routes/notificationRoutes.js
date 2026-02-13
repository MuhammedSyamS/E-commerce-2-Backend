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
    webpush.setVapidDetails('mailto:admin@highphaus.com', publicVapidKey, privateVapidKey);
}

// 1. Subscribe User to Push
router.post('/subscribe', protect, async (req, res) => {
    const subscription = req.body;
    console.log("SUBSCRIBE ENDPOINT HIT:", req.user._id, subscription); // DEBUG
    const user = await User.findById(req.user._id);
    user.pushSubscription = subscription;
    const savedUser = await user.save();
    console.log("SUBSCRIPTION SAVED DB:", savedUser.pushSubscription); // DEBUG
    res.status(201).json({ message: 'Push Subscription Saved' });
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

    // Send to ALL users with subscriptions
    // Find users where pushSubscription is set and not empty
    const users = await User.find({
        'pushSubscription.endpoint': { $exists: true }
    });

    const payload = JSON.stringify({ title, body: message });

    users.forEach(u => {
        webpush.sendNotification(u.pushSubscription, payload).catch(err => console.error(err));
    });

    res.json({ message: `Push sent to ${users.length} devices` });
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
