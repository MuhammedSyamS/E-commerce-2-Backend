const Product = require('../models/Product');
const StockLog = require('../models/StockLog');

/**
 * Logs a stock change to the database.
 * @param {Object} params - The log parameters.
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
    }
};

/**
 * Adjusts stock for a product or variant and logs the change.
 * @param {string} productId 
 * @param {Object} variant - { size, color } (optional)
 * @param {number} qtyChange - Positive to add, negative to subtract
 * @param {string} reason 
 * @param {string} referenceId 
 * @param {string} adminId 
 * @param {string} note 
 */
const adjustStock = async (productId, variant, qtyChange, reason, referenceId = null, adminId = null, note = "") => {
    const product = await Product.findById(productId);
    if (!product) throw new Error("Product not found");

    const oldTotalStock = product.countInStock || 0;

    if (variant && variant.size && variant.color) {
        const vIndex = product.variants.findIndex(v => v.size === variant.size && v.color === variant.color);
        if (vIndex === -1) throw new Error("Variant not found");

        const oldVariantStock = product.variants[vIndex].stock || 0;
        product.variants[vIndex].stock += qtyChange;
        product.countInStock += qtyChange; // Keep main stock in sync

        await product.save();

        // Log variant-specific change
        await logStockChange({
            productId,
            variant,
            oldStock: oldVariantStock,
            newStock: product.variants[vIndex].stock,
            reason,
            referenceId,
            adminId,
            note: note || `Systematic adjustment for ${variant.size}/${variant.color}`
        });
    } else {
        // Main stock adjustment
        product.countInStock += qtyChange;
        await product.save();

        await logStockChange({
            productId,
            oldStock: oldTotalStock,
            newStock: product.countInStock,
            reason,
            referenceId,
            adminId,
            note
        });
    }

    return product;
};

module.exports = { logStockChange, adjustStock };
