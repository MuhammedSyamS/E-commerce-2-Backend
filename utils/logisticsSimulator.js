const Order = require('../models/Order');

// SIMULATION DELAYS (in ms)
const TIME_TO_DISPATCH = 30 * 1000; // 30 seconds after order
const TIME_TO_DELIVER = 60 * 1000;  // 60 seconds after dispatch

const runLogisticsSimulation = async () => {
    try {
        const now = Date.now();

        // 1. AUTO-DISPATCH (Processing -> Shipped)
        // Find orders that are PAID, NOT DISPATCHED, and older than TIME_TO_DISPATCH
        const ordersToDispatch = await Order.find({
            isPaid: true,
            isDispatched: false,
            createdAt: { $lt: new Date(now - TIME_TO_DISPATCH) }
        });

        if (ordersToDispatch.length > 0) {
            console.log(`🚚 LOGISTICS: Dispatching ${ordersToDispatch.length} orders...`);
            for (const order of ordersToDispatch) {
                order.isDispatched = true;
                order.dispatchedAt = now;
                await order.save();
            }
        }

        // 2. AUTO-DELIVER (Shipped -> Delivered)
        // Find orders that are DISPATCHED, NOT DELIVERED, and dispatched older than TIME_TO_DELIVER
        const ordersToDeliver = await Order.find({
            isDispatched: true,
            isDelivered: false,
            dispatchedAt: { $lt: new Date(now - TIME_TO_DELIVER) }
        });

        if (ordersToDeliver.length > 0) {
            console.log(`📦 LOGISTICS: Delivering ${ordersToDeliver.length} orders...`);
            for (const order of ordersToDeliver) {
                order.isDelivered = true;
                order.deliveredAt = now;
                await order.save();
            }
        }

    } catch (error) {
        console.error("LOGISTICS SIMULATION ERROR:", error.message);
    }
};

module.exports = runLogisticsSimulation;
