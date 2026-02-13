const mongoose = require('mongoose');
// require('dotenv').config();
const Product = require('./models/Product');
// const connectDB = require('./config/db');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect('mongodb+srv://shamsaifudheen_db_user:TIPgwZykPJNVQ8Ru@ecommerce.bbxai9g.mongodb.net/highphaus?retryWrites=true&w=majority');
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

const newDescription = `Command Attention Without Saying a Word.

In a world of fast fashion and disposable trends, true style is about substance. The Eagle isn't just a design; it's a declaration of vision, power, and freedom.

We didn't just want to make a ring; we wanted to forge a talisman. Our artisans have meticulously detailed every feather of the Eagle Adjustable Ring to capture the spirit of the apex predator. Cast in premium materials and finished to a high polish, this piece has a weight and presence that mass-produced jewelry simply cannot replicate. It feels powerful because it is powerful.

Don't just wear jewelry—wear a statement. With our precision adjustable design, it promises a perfect fit for any finger, ensuring comfort alongside style. Secure yours today and elevate your everyday carry.`;

const updateProduct = async () => {
    try {
        await connectDB();
        console.log("DB Connected");

        // Find by name (Case insensitive regex)
        const product = await Product.findOne({ name: { $regex: /Eagle Adjustable Ring/i } });

        if (product) {
            console.log(`Found Product: ${product.name} (ID: ${product._id})`);
            product.description = newDescription;
            await product.save();
            console.log("✅ Description Updated Successfully!");
        } else {
            console.log("❌ Product 'Eagle Adjustable Ring' not found.");
        }

        process.exit();
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
};

updateProduct();
