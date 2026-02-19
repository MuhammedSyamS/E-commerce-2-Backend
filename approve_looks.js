require('dotenv').config();
const mongoose = require('mongoose');
const Look = require('./models/Look');

async function approveAll() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const result = await Look.updateMany({ status: 'pending' }, { status: 'approved' });
        console.log(`Approved ${result.modifiedCount} looks.`);

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

approveAll();
