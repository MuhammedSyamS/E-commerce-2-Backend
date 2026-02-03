const mongoose = require('mongoose');
const User = require('./models/User');
const dotenv = require('dotenv');

dotenv.config();

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB");

        // Find a user - we'll just pick the first non-admin or create a dummy
        let user = await User.findOne({ email: 'debug_test@test.com' });
        if (!user) {
            user = await User.create({
                firstName: "Debug",
                lastName: "Test",
                email: "debug_test@test.com",
                password: "password123",
                role: "customer"
            });
            console.log("Created debug user");
        }

        console.log("Attempting to set role=manager, permissions=['manage_products']");

        user.role = 'manager';
        user.isAdmin = false;
        user.permissions = ['manage_products'];

        await user.save();
        console.log("SUCCESS: User updated to manager");

    } catch (err) {
        console.error("FAIL: ", err);
    } finally {
        await mongoose.connection.close();
    }
};

run();
