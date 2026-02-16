const mongoose = require('mongoose');
const Newsletter = require('./models/Newsletter');
const User = require('./models/User');
require('dotenv').config();

const checkCounts = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const subscriberCount = await Newsletter.countDocuments({ isSubscribed: true });
        const userCount = await User.countDocuments({});

        console.log(`Subscribers: ${subscriberCount}`);
        console.log(`Users: ${userCount}`);

        process.exit(0);
    } catch (error) {
        console.error('Check failed:', error);
        process.exit(1);
    }
};

checkCounts();
