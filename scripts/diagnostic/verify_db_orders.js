require('dotenv').config({ path: './server/.env' });
const mongoose = require('mongoose');
const Order = require('./server/models/Order');

mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
        try {
            const count = await Order.countDocuments();
            console.log(`DB/ORDER_COUNT: ${count}`);

            if (count > 0) {
                const sample = await Order.findOne().populate('user', 'firstName email');
                console.log('SAMPLE_ORDER:', JSON.stringify(sample, null, 2));
            }

            process.exit(0);
        } catch (err) {
            console.error(err);
            process.exit(1);
        }
    });
