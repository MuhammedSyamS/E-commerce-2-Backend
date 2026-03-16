const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('./models/Product');
const Order = require('./models/Order');
const StockLog = require('./models/StockLog');

dotenv.config();

const testStockLogs = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected.');

        // 1. Create Test Product
        console.log('\n--- 1. Creating Test Product ---');
        const product = new Product({
            name: 'StockLog Test Product',
            price: 100,
            description: 'Test',
            category: 'Test',
            image: 'test.jpg',
            countInStock: 10,
            variants: [
                { size: 'M', color: 'Blue', stock: 5 }
            ]
        });
        await product.save();
        console.log(`Product Created: ${product._id} (Stock: 10, Variant: 5)`);

        // 2. Simulate Admin Update (via Direct Model Update for test, but controller logic is what we want to test)
        // Since we can't easily call controller functions without mocking req/res, 
        // we will manually rely on the fact that we verified the controller code modification.
        // OR we can simulate the log directly to verify the Model works.
        // But the best test is to see if the LOGGING works when we Modify STOCK.
        // Wait, the logging call is INSIDE the controller. 
        // calling product.save() here WON'T trigger logging because logging is explicit in controller, not a pre-save hook.

        // This script can't fully test the CONTROLLER logic unless we start the server and make API calls.
        // However, we CAN test the 'logStockChange' utility if we import it.

        const { logStockChange } = require('./utils/stockUtils');

        console.log('\n--- 2. Testing logStockChange Utility ---');
        await logStockChange({
            productId: product._id,
            oldStock: 10,
            newStock: 20,
            reason: 'Test Adjustment',
            note: 'Script Test'
        });
        console.log('Log entry created.');

        // 3. Verify Log
        const logs = await StockLog.find({ product: product._id });
        console.log(`\n--- 3. Verifying Logs (${logs.length} found) ---`);
        logs.forEach(log => {
            console.log(`[${log.reason}] ${log.oldStock} -> ${log.newStock} (${log.note})`);
        });

        if (logs.length > 0) {
            console.log('✅ StockLog Model and Utility working.');
        } else {
            console.error('❌ No logs found!');
        }

        // Cleanup
        console.log('\n--- Cleanup ---');
        await Product.deleteOne({ _id: product._id });
        await StockLog.deleteMany({ product: product._id });
        console.log('Cleaned up.');

    } catch (error) {
        console.error('Test Failed:', error);
    } finally {
        await mongoose.disconnect();
    }
};

testStockLogs();
