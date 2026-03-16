
const axios = require('axios');
const mongoose = require('mongoose');
const User = require('./models/User');
const Notification = require('./models/Notification');
require('dotenv').config();

const testNotifications = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB");

        const user = await User.findOne();
        if (!user) {
            console.log("No user found.");
            process.exit();
        }
        console.log(`Testing with user: ${user.email} (${user._id})`);

        // 1. Create a "Legacy" Notification (Wrong URL)
        const legacyNotif = await Notification.create({
            user: user._id,
            title: "Legacy Order Test",
            message: "This has the OLD /account/orders/ link. It should auto-fix.",
            type: 'order',
            data: {
                url: '/account/orders/67a21b34567890abcdef1234',
                orderId: '67a21b34567890abcdef1234'
            }
        });
        console.log("Created Legacy Notification:", legacyNotif._id);

        // 2. Create a "New" Notification (Correct URL)
        const newNotif = await Notification.create({
            user: user._id,
            title: "New Order Test",
            message: "This has the NEW /order/ link. It should work directly.",
            type: 'order',
            data: {
                url: '/order/67a21b34567890abcdef1234',
                orderId: '67a21b34567890abcdef1234'
            }
        });
        console.log("Created New Notification:", newNotif._id);

        process.exit();
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
};

testNotifications();
