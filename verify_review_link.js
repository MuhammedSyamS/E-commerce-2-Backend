const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('./models/Product');
const Order = require('./models/Order');

dotenv.config();

const verifyFlow = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("DB Connected.");

        // 1. Get a Real Product
        const product = await Product.findOne();
        if (!product) throw new Error("No products in DB!");
        console.log("Step 1: Found Product:", product.name, product._id);

        // 2. Create Dummy Order with this Product (Simulate Frontend)
        // Note: We use the ID string as item.product similar to frontend payload
        const dummyItem = {
            name: product.name,
            qty: 1,
            image: product.image,
            price: product.price,
            product: product._id // Mongoose casting handles this
        };

        const order = new Order({
            user: new mongoose.Types.ObjectId(), // Fake user
            orderItems: [dummyItem],
            shippingAddress: { address: 'Test', city: 'Test', postalCode: '123', phone: '123' },
            paymentMethod: 'cod',
            totalPrice: 100
        });

        const savedOrder = await order.save();
        console.log("Step 2: Created Order:", savedOrder._id);

        // 3. Retrieve Order and Check Product Field
        const fetchedOrder = await Order.findById(savedOrder._id);
        const savedProductItem = fetchedOrder.orderItems[0].product;
        console.log("Step 3: Stored Product Field:", savedProductItem, "Type:", typeof savedProductItem);

        // 4. Simulate 'Write Review' Click -> Navigate to /product/:id
        // The frontend calls: axios.get('/api/products/' + savedProductItem)

        const slugOrId = savedProductItem.toString();

        // 5. Simulate Backend Controller Logic
        const foundProduct = await Product.findOne({
            $or: [
                { slug: slugOrId },
                { _id: slugOrId.match(/^[0-9a-fA-F]{24}$/) ? slugOrId : null }
            ].filter(Boolean)
        });

        console.log("Step 5: Backend Search Result:", foundProduct ? "FOUND!" : "NOT FOUND (BUG)");

        if (foundProduct) {
            console.log("   Matched via:", foundProduct.slug === slugOrId ? "Slug" : "ID");
        }

        // Clean up
        await Order.deleteOne({ _id: savedOrder._id });
        process.exit();

    } catch (err) {
        console.error("ERROR:", err);
        process.exit(1);
    }
};

verifyFlow();
