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
                                const oldStockVar = product.variants[vIndex].stock;
                                product.variants[vIndex].stock += qty;

                                const oldStockMain = product.countInStock;
                                product.countInStock += qty; // Sync main stock

                                logStockChange({
                                    productId: product._id,
                                    variant: item.selectedVariant,
                                    oldStock: oldStockVar,
                                    newStock: product.variants[vIndex].stock,
                                    reason: 'Cron Restore',
                                    referenceId: order._id, // Using Order ID as reference
                                    note: `Cron: Stale Pending Order Cleanup`
                                });
                                logStockChange({
                                    productId: product._id,
                                    oldStock: oldStockMain,
                                    newStock: product.countInStock,
                                    reason: 'Cron Restore',
                                    referenceId: order._id,
                                    note: `Cron: Stale Pending Order Cleanup (Main Sync)`
                                });

                                console.log(`   + Restored ${qty} to ${product.name} (${item.selectedVariant.size}/${item.selectedVariant.color})`);
                            } else {
                                // Variant missing? Fallback to main stock
                                const oldStock = product.countInStock;
                                product.countInStock += qty;
                                logStockChange({
                                    productId: product._id,
                                    oldStock: oldStock,
                                    newStock: product.countInStock,
                                    reason: 'Cron Restore',
                                    referenceId: order._id,
                                    note: `Cron: Stale Pending Order Cleanup (Variant Mismatch)`
                                });
                                console.log(`   + Restored ${qty} to ${product.name} (Variant mismatch fallback)`);
                            }
                        } else {
                            // No variant
                            const oldStock = product.countInStock;
                            product.countInStock += qty;
                            logStockChange({
                                productId: product._id,
                                oldStock: oldStock,
                                newStock: product.countInStock,
                                reason: 'Cron Restore',
                                referenceId: order._id,
                                note: `Cron: Stale Pending Order Cleanup`
                            });
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
    // Run every 30 minutes for Abandoned Carts
    cron.schedule('*/30 * * * *', async () => {
        console.log('🛒 Checking for Abandoned Carts...');
        try {
            // Find users who:
            // 1. Have items in cart
            // 2. Haven't updated their cart in last 1 hour
            // 3. Haven't received an abandoned cart email yet (or at least not since last update)

            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

            const users = await User.find({
                "cart.0": { $exists: true }, // Cart not empty
                updatedAt: { $lt: oneHourAgo }, // Inactive for 1 hour
                $or: [
                    { abandonedCartEmailSentAt: { $exists: false } }, // Never sent
                    { abandonedCartEmailSentAt: null },
                    // If we want to resend, we'd need complex logic comparing sentAt vs updatedAt
                    // For now, strict: only if not sent since last update (which updates 'updatedAt')
                    // Actually, simple approach: If sentAt < updatedAt, it means they updated cart AFTER we sent email
                    // BUT we only find where updatedAt < 1 hour ago.
                    // So: sentAt < updatedAt AND updatedAt < 1 hour ago
                    { $expr: { $lt: ["$abandonedCartEmailSentAt", "$updatedAt"] } }
                ]
            });

            if (users.length > 0) {
                console.log(`📧 Found ${users.length} potential abandoned carts.`);

                const { sendEmail } = require('./sendEmail'); // Lazy load to avoid circular dept issues if any
                const { getAbandonedCartTemplate } = require('./emailTemplates');

                for (const user of users) {
                    console.log(`   -> Sending nudge to ${user.email}`);

                    const html = getAbandonedCartTemplate(user, user.cart);

                    await sendEmail({
                        email: user.email,
                        subject: 'You left something behind...',
                        message: 'Complete your purchase', // Fallback text
                        html
                    });

                    // Mark as sent
                    user.abandonedCartEmailSentAt = new Date();
                    await user.save();
                }
            } else {
                console.log('✅ No abandoned carts found.');
            }

        } catch (error) {
            console.error('❌ Abandoned Cart Job Error:', error.message);
        }
    });
};

module.exports = startCronJobs;
