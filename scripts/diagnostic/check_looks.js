const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Look = require('./models/Look');
const User = require('./models/User');

dotenv.config();

const checkLooks = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB...");

    const looks = await Look.find().populate('user', 'firstName lastName email');
    console.log(`Found ${looks.length} looks.`);

    looks.forEach((look, index) => {
      console.log(`\nLook ${index + 1}:`);
      console.log(`ID: ${look._id}`);
      if (look.user) {
        console.log(`User ID: ${look.user._id}`);
        console.log(`User Name: ${look.user.firstName} ${look.user.lastName}`);
        console.log(`User Email: ${look.user.email}`);
      } else {
        console.log(`User: NULL/UNDEFINED (Check raw user ID: ${look.user})`);
      }
    });

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

checkLooks();
