const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Look = require('./models/Look');
const User = require('./models/User');

dotenv.config();

const migrateName = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB for migration...");

    const looks = await Look.find().populate('user', 'firstName lastName');
    console.log(`Processing ${looks.length} looks...`);

    let updatedCount = 0;
    for (const look of looks) {
      if (look.user) {
        const fullName = `${look.user.firstName} ${look.user.lastName}`.trim();
        look.userName = fullName;
        await look.save();
        updatedCount++;
      } else {
        // For orphans, we assign a placeholder if we want, OR keep it as is.
        // But the user wants to see the name. If it's gone, we can't do much.
        // However, we can at least mark it as "Guest Stylist" or something better than "Slook Member".
        look.userName = "House Stylist"; 
        await look.save();
        updatedCount++;
      }
    }

    console.log(`Migration complete. Updated ${updatedCount} looks.`);
    process.exit(0);
  } catch (err) {
    console.error("Migration Error:", err);
    process.exit(1);
  }
};

migrateName();
