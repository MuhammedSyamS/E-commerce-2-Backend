const StockLog = require('../models/StockLog');

/**
 * Logs a stock change to the database.
 * @param {Object} params - The log parameters.
 * @param {string} params.productId - The ID of the product.
 * @param {Object} [params.variant] - { size, color } if applicable.
 * @param {number} params.oldStock - Stock before change.
 * @param {number} params.newStock - Stock after change.
 * @param {string} params.reason - 'Order', 'Restock', 'Admin Adjustment', etc.
 * @param {string} [params.referenceId] - Related Order ID or similar.
 * @param {string} [params.adminId] - User ID of admin making change.
 * @param {string} [params.note] - Additional details.
 */
const logStockChange = async ({ productId, variant, oldStock, newStock, reason, referenceId, adminId, note }) => {
    try {
        const change = newStock - oldStock;

        // Don't log zero changes unless explicit
        if (change === 0 && reason !== 'Admin Adjustment') return;

        await StockLog.create({
            product: productId,
            variant,
            previousStock: oldStock,
            newStock,
            change,
            reason,
            referenceId,
            adminUser: adminId,
            description: note
        });

        console.log(`📝 Stock Logged: ${reason} | Product: ${productId} | Change: ${change} | New: ${newStock}`);
    } catch (error) {
        console.error("❌ Stock Logging Failed:", error.message);
        // We do NOT throw here, as logging failure shouldn't crash the main flow
    }
};

module.exports = { logStockChange };
