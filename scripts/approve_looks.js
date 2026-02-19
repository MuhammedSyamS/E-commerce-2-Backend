const mongoose = require('mongoose');
require('dotenv').config(); // Default path (CWD)
const Look = require('../models/Look');

const approveLooks = async () => {
    try {
        console.log('Connecting to DB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const result = await Look.updateMany(
            { status: 'pending' },
            { $set: { status: 'approved' } }
        );

        console.log(`Approved ${result.modifiedCount} pending looks.`);
        process.exit();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

approveLooks();
