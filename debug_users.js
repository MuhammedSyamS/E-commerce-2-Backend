const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

const debugUsers = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("DB Connected.");

        const users = await User.find({}, '_id firstName email');
        console.log(`\n--- FOUND ${users.length} USERS ---`);
        users.forEach((u, i) => {
            console.log(`User ${i + 1}:`);
            console.log(`  ID: ${u._id}`);
            console.log(`  Name: ${u.firstName}`);
            console.log(`  Email: ${u.email}`);
            console.log("-------------------");
        });

        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

debugUsers();
