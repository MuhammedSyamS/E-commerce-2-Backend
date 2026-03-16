require('dotenv').config();

try {
    console.log('Testing import: orderController');
    require('./controllers/orderController');
    console.log('SUCCESS: orderController loaded');
} catch (error) {
    console.error('FAIL: orderController crashed');
    console.error('MESSAGE:', error.message);
    console.error('STACK:', error.stack);
}
