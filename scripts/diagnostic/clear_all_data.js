const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Order = require('./models/Order');
const User = require('./models/User');

dotenv.config();

const clearData = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected...");

        // 1. Delete All Orders
        const ordRes = await Order.deleteMany({});
        console.log(`Deleted ${ordRes.deletedCount} orders.`);

        // 2. Clear All Carts
        const userRes = await User.updateMany({}, { $set: { cart: [] } });
        console.log(`Reset carts for ${userRes.modifiedCount} users.`);

        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

clearData();
