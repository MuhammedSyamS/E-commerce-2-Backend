const orderController = require('./controllers/orderController');
const userController = require('./controllers/userController');

console.log("Order Controller Exports:");
Object.keys(orderController).forEach(key => {
    console.log(`- ${key}: ${typeof orderController[key]}`);
});

console.log("\nUser Controller Exports:");
Object.keys(userController).forEach(key => {
    console.log(`- ${key}: ${typeof userController[key]}`);
});

process.exit(0);
