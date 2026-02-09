const cron = require('node-cron');
const Order = require('../models/Order');
const Product = require('../models/Product');

const startCronJobs = () => {
    console.log('⏳ Cron Jobs Initialized...');

    // Run every 1 minute (Accelerated for immediate feedback)
    cron.schedule('*/1 * * * *', async () => {
        console.log('🔄 Running Cleanup for Stale Pending Orders...');
        try {
            // 1. Find orders that are:
            // - Pending (or Processing/Confirmed but Unpaid?) -> Strictly 'Pending' usually implies initial state
            // - NOT Paid (isPaid: false)
            // - Created > 30 minutes ago
            // - Measurement: Date.now() - 30 mins
            const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);

            const staleOrders = await Order.find({
                isPaid: false,
                paymentMethod: 'Online', // Only target online flows that were abandoned. COD might be pending for days.
                createdAt: { $lt: thirtyMinsAgo },
                orderStatus: { $ne: 'Cancelled' } // Don't process already cancelled
            });

            if (staleOrders.length === 0) {
                console.log('✅ No stale orders found.');
                return;
            }

            console.log(`⚠️ Found ${staleOrders.length} stale orders. Processing...`);

            for (const order of staleOrders) {
                console.log(`Checking Order ${order._id}...`);

                let stockRestored = false;

                // Restore Stock for each item
                for (const item of order.orderItems) {
                    // Safety check: Don't double restore if we track item status (which we do, but 'Pending' implies untouched)
                    // But let's check strict item status just in case
                    if (item.status === 'Cancelled' || item.status === 'Returned') continue;

                    const product = await Product.findById(item.product);
                    if (product) {
                        const qty = item.qty || item.quantity;

                        // Variant logic
                        if (item.selectedVariant) {
                            const vIndex = product.variants.findIndex(v =>
                                v.size === item.selectedVariant.size &&
                                v.color === item.selectedVariant.color
                            );

                            if (vIndex !== -1) {
                                product.variants[vIndex].stock += qty;
                                product.countInStock += qty; // Sync main stock
                                console.log(`   + Restored ${qty} to ${product.name} (${item.selectedVariant.size}/${item.selectedVariant.color})`);
                            } else {
                                // Variant missing? Fallback to main stock
                                product.countInStock += qty;
                                console.log(`   + Restored ${qty} to ${product.name} (Variant mismatch fallback)`);
                            }
                        } else {
                            // No variant
                            product.countInStock += qty;
                            console.log(`   + Restored ${qty} to ${product.name}`);
                        }

                        await product.save();
                        stockRestored = true;
                    }
                }

                // Mark Order as Cancelled
                order.orderStatus = 'Cancelled';
                order.isDelivered = false; // Just to be sure

                // Add a note if possible, or just save
                // Schema doesn't have internal notes, so just status update
                await order.save();
                console.log(`❌ Order ${order._id} Cancelled (Stale).`);
            }

        } catch (error) {
            console.error('❌ Cron Job Error:', error.message);
        }
    });
};

module.exports = startCronJobs;
