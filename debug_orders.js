const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Order = require('./models/Order');
const Product = require('./models/Product');

dotenv.config();

const debugOrder = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected...");

        const order = await Order.findOne().sort({ createdAt: -1 });
        if (!order) {
            console.log("No orders found.");
            process.exit();
        }

        console.log("Latest Order ID:", order._id);
        const item = order.orderItems[0];
        const prodId = item.product; // This might be an object if populated, or ID if not? 
        // Note: In Node script, Mongoose might not auto-populate unless told, so it is likely ID.

        console.log("Item Product Field:", prodId);

        let idToCheck = prodId;
        if (prodId && prodId._id) idToCheck = prodId._id;

        console.log("Checking ID:", idToCheck);

        const exists = await Product.findById(idToCheck);
        console.log("Does Product Exist in DB?", !!exists);
        if (exists) console.log("Product Name:", exists.name);

        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

debugOrder();
