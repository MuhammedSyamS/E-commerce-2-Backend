const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('./models/Product');
const Order = require('./models/Order');

dotenv.config();

const verifyCheckout = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("DB Connected.");

        // 1. Get a Real Product to mimic Cart Item
        const product = await Product.findOne();
        if (!product) { console.log("No products."); process.exit(); }
        console.log("Using Product:", product.name, product._id);

        // 2. Simulate Checkout Payload (from Checkout.jsx)
        // cartItems.map logic: product: item.product?._id || item.product || item._id
        // Valid scenarios:
        // A: item is full product object
        const payloadA = product._id; // cart item IS the product object

        const orderData = {
            user: new mongoose.Types.ObjectId(),
            orderItems: [{
                name: product.name,
                qty: 1,
                image: product.image,
                price: product.price,
                product: payloadA // Simulating what frontend sends
            }],
            shippingAddress: { address: 'T', city: 'T', postalCode: '1', phone: '1' },
            paymentMethod: 'cod',
            totalPrice: 100
        };

        // 3. Save Order (Simulate Controller)
        const order = new Order(orderData);
        const saved = await order.save();
        console.log("Created Order:", saved._id);

        // 4. Retrieve with Populate (Simulate Controller getOrderById)
        const fetched = await Order.findById(saved._id).populate({
            path: 'orderItems.product',
            select: 'slug name image'
        });

        const item = fetched.orderItems[0];
        console.log("Populated Product:", item.product);

        if (!item.product) {
            console.log("FAIL: Product is null!");
        } else {
            console.log("SUCCESS: Product populated. Type:", typeof item.product);
            console.log("Slug:", item.product.slug);
        }

        await Order.deleteOne({ _id: saved._id });
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

verifyCheckout();
