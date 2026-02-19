const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('../models/Product');
const User = require('../models/User');
const fs = require('fs');

dotenv.config({ path: '.env' }); // Explicit path if running from server dir

const checkReviews = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('DB Connected');

        const products = await Product.find({ 'reviews.0': { $exists: true } }).populate('reviews.user', 'firstName lastName email');

        let output = `Found ${products.length} products with reviews.\n`;
        let totalReviews = 0;
        let problematicReviews = 0;

        for (const product of products) {
            output += `\nProduct: ${product.name} (ID: ${product._id})\n`;
            for (const review of product.reviews) {
                totalReviews++;
                const userName = review.user ? `${review.user.firstName} ${review.user.lastName}` : 'UNKNOWN USER';
                const userEmail = review.user ? review.user.email : 'N/A';

                output += `  - Review ID: ${review._id}\n`;
                output += `    Rating: ${review.rating}, Comment: ${review.comment.substring(0, 30)}...\n`;
                output += `    Stored Name: "${review.name}"\n`;
                output += `    Linked User: ${userName} (${userEmail})\n`;

                if (!review.user) {
                    output += `    [WARNING] Review has no associated user!!\n`;
                    problematicReviews++;
                } else if (review.name !== userName) {
                    output += `    [NOTICE] Stored name does not match current user name.\n`;
                }
            }
        }

        output += `\nTotal Reviews: ${totalReviews}\n`;
        output += `Problematic Reviews (No User): ${problematicReviews}\n`;

        fs.writeFileSync('review_check_output.txt', output);
        console.log('Output written to review_check_output.txt');
        process.exit();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

checkReviews();
