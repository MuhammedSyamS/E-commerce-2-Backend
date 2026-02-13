const mongoose = require('mongoose');
const Notification = require('./models/Notification');
const User = require('./models/User');
require('dotenv').config();

const sendTestNotification = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB");

        // Find a user (replace with a real user ID if needed, or get first user)
        const user = await User.findOne();
        if (!user) {
            console.log("No users found.");
            process.exit();
        }

        console.log(`Sending test notification to: ${user.firstName} (${user._id})`);

        const notification = {
            user: user._id,
            title: "Test: Order Shipped",
            message: "Your order #123456 has been shipped! Click to track.",
            type: "order",
            data: {
                image: "https://images.pexels.com/photos/9461772/pexels-photo-9461772.jpeg?auto=compress&cs=tinysrgb&w=1600",
                url: "/account/orders"
            }
        };

        await Notification.create(notification);
        console.log("Notification created in DB. Refresh your notifications page.");

        process.exit();
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
};

sendTestNotification();
