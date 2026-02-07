const express = require('express');
const router = express.Router();
const webpush = require('web-push');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { protect, admin } = require('../middleware/authMiddleware');

// CONFIGURE VAPID KEYS (Should come from ENV, but hardcoded for demo simplicity/stability if env fails)
// REPLACE THESE WITH KEYS FROM YOUR TERMINAL OUTPUT
// CONFIGURE VAPID KEYS
const publicVapidKey = 'BBpKl_F-zOM-ujMnUcgudUiVjEIELl0oarZBM8tF9_HAn0bx_MUhxym_5anPaEA653crE40tnwxdAzo1HlIfIh4';
const privateVapidKey = '8YJkTEUta_Pf27ti54Tf8RsgqP8a7h-XRPeMODLEcuw';

webpush.setVapidDetails('mailto:admin@highphaus.com', publicVapidKey, privateVapidKey);

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

module.exports = router;
