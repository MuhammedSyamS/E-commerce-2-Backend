const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Order = require('./models/Order');

dotenv.config();

const clearOrders = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB...");

        const result = await Order.deleteMany({});
        console.log(`Deleted ${result.deletedCount} orders.`);

        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

clearOrders();
