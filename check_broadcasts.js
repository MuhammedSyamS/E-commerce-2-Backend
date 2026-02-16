const mongoose = require('mongoose');
const Broadcast = require('./models/Broadcast');
require('dotenv').config();

const checkBroadcasts = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const broadcasts = await Broadcast.find({}).sort({ createdAt: -1 }).limit(5);
        console.log('Recent Broadcasts:', JSON.stringify(broadcasts, null, 2));

        process.exit(0);
    } catch (error) {
        console.error('Check failed:', error);
        process.exit(1);
    }
};

checkBroadcasts();
