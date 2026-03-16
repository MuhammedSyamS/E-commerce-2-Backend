const mongoose = require('mongoose');
const User = require('./models/User');
const dotenv = require('dotenv');

dotenv.config();

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB");

        const users = await User.find({}, 'firstName email role isAdmin permissions');
        console.log("--- USER DATABASE STATE ---");
        users.forEach(u => {
            console.log(`User: ${u.email} | Role: ${u.role} | Admin: ${u.isAdmin} | Perms: ${JSON.stringify(u.permissions)}`);
        });
        console.log("---------------------------");

    } catch (err) {
        console.error("FAIL: ", err);
    } finally {
        await mongoose.connection.close();
    }
};

run();
