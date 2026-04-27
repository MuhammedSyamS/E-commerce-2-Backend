const Product = require('../models/Product');
const StockLog = require('../models/StockLog');

/**
 * Logs a stock change to the database.
 * @param {Object} params - The log parameters.
 */
const logStockChange = async ({ productId, variant, oldStock, newStock, reason, referenceId, adminId, note }, options = {}) => {
    try {
        const change = newStock - oldStock;
        if (change === 0 && reason !== 'Admin Adjustment') return;

        await StockLog.create([{
            product: productId,
            variant,
            previousStock: oldStock,
            newStock,
            change,
            reason,
            referenceId,
            adminUser: adminId,
            description: note
        }], options);

    } catch (error) {
        console.error("❌ Stock Logging Failed:", error.message);
    }
};

const adjustStock = async (productId, variant, qtyChange, reason, referenceId = null, adminId = null, note = "", options = {}) => {
    const product = await Product.findById(productId).session(options.session || null);
    if (!product) throw new Error("Product not found");

    const oldTotalStock = product.countInStock || 0;

    if (variant && (variant.size || variant.color)) {
        const vIndex = product.variants.findIndex(v => 
            (variant.size ? v.size === variant.size : true) && 
            (variant.color ? v.color === variant.color : true)
        );
        
        if (vIndex === -1) throw new Error("Variant not found");

        const oldVariantStock = product.variants[vIndex].stock || 0;
        product.variants[vIndex].stock += qtyChange;
        
        if (product.variants[vIndex].stock < 0) {
            throw new Error(`Insufficient stock for ${product.name} (${variant.size || ''} ${variant.color || ''})`);
        }

        product.countInStock += qtyChange;
        await product.save(options);

        await logStockChange({
            productId,
            variant,
            oldStock: oldVariantStock,
            newStock: product.variants[vIndex].stock,
            reason,
            referenceId,
            adminId,
            note: note || `Systematic adjustment for ${variant.size || ''}/${variant.color || ''}`
        }, options);
    } else {
        product.countInStock += qtyChange;
        if (product.countInStock < 0) {
            throw new Error(`Insufficient stock for ${product.name}`);
        }
        await product.save(options);

        await logStockChange({
            productId,
            oldStock: oldTotalStock,
            newStock: product.countInStock,
            reason,
            referenceId,
            adminId,
            note
        }, options);
    }

    return product;
};

module.exports = { logStockChange, adjustStock };
