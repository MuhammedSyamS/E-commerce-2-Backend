require('dotenv').config();
const mongoose = require('mongoose');
const Look = require('./models/Look');

async function checkLooks() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const total = await Look.countDocuments({});
        const approved = await Look.countDocuments({ status: 'approved' });
        const pending = await Look.countDocuments({ status: 'pending' });
        const rejected = await Look.countDocuments({ status: 'rejected' });

        console.log(`Total Looks: ${total}`);
        console.log(`Approved Looks: ${approved}`);
        console.log(`Pending Looks: ${pending}`);
        console.log(`Rejected Looks: ${rejected}`);

        if (total > 0) {
            const sample = await Look.find({}).sort({ createdAt: -1 }).limit(1);
            console.log('Latest Look:', JSON.stringify(sample, null, 2));
        }

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

checkLooks();
