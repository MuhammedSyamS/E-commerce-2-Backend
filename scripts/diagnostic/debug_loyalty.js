const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, 'server/.env') });

const User = require('./server/models/User');
const LoyaltyTransaction = require('./server/models/LoyaltyTransaction');
const Order = require('./server/models/Order');

async function debugLoyalty() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/slook');
        console.log('Connected to DB');

        // Find the user (assuming we can find them by email or list first)
        const user = await User.findOne({}).sort({ createdAt: -1 }); // Get most recent user for testing
        if (!user) {
            console.log('No user found');
            return;
        }
        console.log(`Checking data for user: ${user.email} (${user._id})`);

        const txs = await LoyaltyTransaction.find({ user: user._id });
        console.log(`Found ${txs.length} transactions`);
        if (txs.length > 0) {
            console.log('Sample transaction:', txs[0]);
        }

        const orders = await Order.find({ user: user._id });
        console.log(`Found ${orders.length} orders`);
        if (orders.length > 0) {
            console.log('Sample order status:', orders[0].orderStatus, 'TotalPrice:', orders[0].totalPrice);
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

debugLoyalty();
