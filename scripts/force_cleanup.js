const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const dotenv = require('dotenv');

const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const forceCleanup = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("DB Connected. Forcing Cleanup...");

        // Find ALL stale pending online orders irrespective of time (for immediate fix)
        // or just apply the same logic. Let's be aggressive for the "Force" run.
        const staleOrders = await Order.find({
            isPaid: false,
            paymentMethod: 'Online',
            orderStatus: { $ne: 'Cancelled' }
            // Removed time filter to clean EVERYTHING pending/stale right now
        });

        console.log(`Found ${staleOrders.length} pending online orders.`);

        for (const order of staleOrders) {
            console.log(`Processing Order ${order._id}...`);
            for (const item of order.orderItems) {
                if (item.status === 'Cancelled') continue;

                const product = await Product.findById(item.product);
                if (product) {
                    const qty = item.qty || item.quantity;
                    if (item.selectedVariant) {
                        const vIndex = product.variants.findIndex(v =>
                            v.size === item.selectedVariant.size &&
                            v.color === item.selectedVariant.color
                        );
                        if (vIndex !== -1) {
                            product.variants[vIndex].stock += qty;
                            console.log(`  + Restored Variant Stock: ${qty}`);
                        }
                    }
                    product.countInStock += qty;
                    await product.save();
                    console.log(`  + Restored Main Stock: ${qty}`);
                }
            }
            order.orderStatus = 'Cancelled';
            await order.save();
            console.log(`  x Order Cancelled`);
        }

        console.log("Cleanup Done.");
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

forceCleanup();
