const webpush = require('web-push');
const User = require('../models/User');
const Notification = require('../models/Notification');

// CONFIGURE KEYS (Should ideally be env vars)
const publicVapidKey = 'BBpKl_F-zOM-ujMnUcgudUiVjEIELl0oarZBM8tF9_HAn0bx_MUhxym_5anPaEA653crE40tnwxdAzo1HlIfIh4';
const privateVapidKey = '8YJkTEUta_Pf27ti54Tf8RsgqP8a7h-XRPeMODLEcuw';

webpush.setVapidDetails('mailto:admin@highphaus.com', publicVapidKey, privateVapidKey);

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
            console.log(`Push sent to user ${userId}`);
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

        console.log(`Sending Broadcast Push to ${users.length} users...`);
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
        console.log("Broadcast complete.");
    } catch (error) {
        console.error("Broadcast Push Error:", error);
    }
};
