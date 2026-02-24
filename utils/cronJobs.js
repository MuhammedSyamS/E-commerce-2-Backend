const cron = require('node-cron');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User'); // ADDED
const { logStockChange } = require('./stockUtils'); // ADDED

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
                if (!order || !order.orderItems) continue;
                console.log(`Checking Order ${order._id}...`);

                // --- SYSTEMATIC CHANGE: NO AUTOMATIC RESTORE ---
                // The user requested that stock should NOT be added automatically.
                // We will only mark the order as Cancelled. 
                // Stock must be restored manually by an admin if desired.

                console.log(`   - Order ${order._id} is stale. Cancelling WITHOUT automatic stock restore.`);

                // Mark Order as Cancelled
                order.orderStatus = 'Cancelled';
                order.orderNote = (order.orderNote || '') + ' [Auto-Cancelled: Stale Pending Payment]';
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

                const sendEmail = require('./sendEmail'); // FIXED: No destructuring
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

    // Run Daily at 3 AM for System Cleanup
    cron.schedule('0 3 * * *', async () => {
        console.log('🧹 Running System Cleanup (Coupons, etc.)...');
        try {
            const Coupon = require('../models/Coupon');
            const now = new Date();

            // 1. Deactivate Expired Coupons
            const expired = await Coupon.updateMany(
                { expiryDate: { $lt: now }, isActive: true },
                { $set: { isActive: false } }
            );
            console.log(`✅ Deactivated ${expired.modifiedCount} expired coupons.`);

            // 2. Low Stock Alerts
            const lowStockProducts = await Product.find({ countInStock: { $lt: 5 }, isActive: true });
            const Alert = require('../models/Alert');

            for (const p of lowStockProducts) {
                // Only create if not already alerted recently (avoid duplication)
                const exists = await Alert.findOne({
                    relatedId: p._id,
                    type: 'low_stock',
                    isRead: false
                });

                if (!exists) {
                    await Alert.create({
                        type: 'low_stock',
                        severity: p.countInStock === 0 ? 'critical' : 'warning',
                        message: `Product "${p.name}" is ${p.countInStock === 0 ? 'out of stock' : 'running low (' + p.countInStock + ' left)'}.`,
                        relatedId: p._id,
                        metadata: { slug: p.slug, count: p.countInStock }
                    });
                }
            }
            console.log(`✅ Processed ${lowStockProducts.length} low stock checks.`);

            // 3. Loyalty Points Expiration (90 Days)
            console.log('🪙 Checking for Expired Slook Coins...');
            const LoyaltyTransaction = require('../models/LoyaltyTransaction');

            // Find 'earn' transactions that are expired but not yet processed
            const expiredTxs = await LoyaltyTransaction.find({
                type: 'earn',
                isExpired: false,
                expiryDate: { $lt: now }
            });

            if (expiredTxs.length > 0) {
                console.log(`⚠️ Found ${expiredTxs.length} expired coin transactions. Deducting...`);
                for (const tx of expiredTxs) {
                    const user = await User.findById(tx.user);
                    if (user) {
                        const amountToDeduct = tx.amount;
                        user.loyaltyPoints = Math.max(0, user.loyaltyPoints - amountToDeduct);
                        await user.save();

                        // Mark transaction as expired
                        tx.isExpired = true;
                        await tx.save();

                        // Log Expiration Transaction
                        await LoyaltyTransaction.create({
                            user: user._id,
                            type: 'expire',
                            amount: amountToDeduct,
                            description: `Coins expired (90-day limit reached)`,
                            referenceId: tx._id, // Reference the original earn tx
                            referenceModel: 'User' // Or keep blank
                        });
                        console.log(`   - Deducted ${amountToDeduct} coins from ${user.email} due to expiry.`);
                    }
                }
            } else {
                console.log('✅ No expired coins found.');
            }

        } catch (error) {
            console.error('❌ System Cleanup Error:', error.message);
        }
    });
};

module.exports = startCronJobs;
