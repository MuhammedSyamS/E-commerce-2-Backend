const mongoose = require('mongoose');
const Notification = require('./models/Notification');
const User = require('./models/User');
require('dotenv').config();

const generateTestNotifs = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        const user = await User.findOne();
        if (!user) return process.exit();

        const notifs = [
            {
                user: user._id,
                title: "Order Shipped: Silver Chain #9021",
                message: "Your premium silver chain has been dispatched via BlueDart. Track your luxury shipment now.",
                type: "order",
                isRead: false,
                data: {
                    image: "https://images.pexels.com/photos/9461772/pexels-photo-9461772.jpeg?auto=compress&cs=tinysrgb&w=1600",
                    url: "/account/orders"
                }
            },
            {
                user: user._id,
                title: "New Drop: Miso Collection",
                message: "The new Miso Minimalist collection is live. 20% off for the next 24 hours.",
                type: "promo",
                isRead: true,
                data: {
                    image: "https://images.pexels.com/photos/10972439/pexels-photo-10972439.jpeg?auto=compress&cs=tinysrgb&w=1600",
                    url: "/shop?collection=miso"
                }
            }
        ];

        await Notification.insertMany(notifs);
        console.log("Generated 2 MNC-style notifications.");
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

generateTestNotifs();
