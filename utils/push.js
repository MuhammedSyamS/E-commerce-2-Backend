const webpush = require('web-push');
const vault = require('../config/vault');
const User = require('../models/User');
const Notification = require('../models/Notification');

// CONFIGURE KEYS (Using Vault for Security)
const publicVapidKey = vault.VAPID_PUBLIC_KEY;
const privateVapidKey = vault.VAPID_PRIVATE_KEY;

if (publicVapidKey && privateVapidKey) {
    webpush.setVapidDetails('mailto:admin@slook.com', publicVapidKey, privateVapidKey);
}

// Send to specific user
exports.sendToUser = async (userId, title, message, data = {}) => {
    try {
        // 1. Save to DB History
        // data.image and data.url should be passed here if available
        await Notification.create({ user: userId, title, message, type: 'order', data });

        // 2. Send Push
        const user = await User.findById(userId);
        if (user && user.pushSubscription) {
            // Payload: title, body, icon/image, data: { url: ... }
            const payload = JSON.stringify({
                title,
                body: message,
                image: data.image, // Product Image
                url: data.url     // Deep link
            });
            await webpush.sendNotification(user.pushSubscription, payload);
        }
    } catch (error) {
        console.error(`Failed to send push to user ${userId}:`, error.message);
    }
};

// Send to ALL subscribers (Marketing / New Drops)
exports.sendToAll = async (title, message, data = {}) => {
    try {
        // 1. Save to DB Global History
        await Notification.create({ title, message, type: 'promo', data });

        // 2. Fetch all subscribed users
        const users = await User.find({ pushSubscription: { $exists: true } });

        const payload = JSON.stringify({
            title,
            body: message,
            image: data.image,
            url: data.url
        });

        // Send in parallel (with robust error handling)
        const promises = users.map(u =>
            webpush.sendNotification(u.pushSubscription, payload)
                .catch(err => {
                    if (err.statusCode === 410) {
                        // Subscription expired/gone, remove it?
                        // u.pushSubscription = undefined; await u.save(); 
                    }
                    console.error(`Push failed for user ${u._id}:`, err.message);
                })
        );

        await Promise.all(promises);
    } catch (error) {
        console.error("Broadcast Push Error:", error);
    }
};
