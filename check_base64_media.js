const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const Product = require('./models/Product');

const checkBase64 = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("DB Connected.");

        const products = await Product.find({ 'reviews.0': { $exists: true } });
        console.log(`Found ${products.length} products with reviews.`);

        let base64Found = false;

        products.forEach(p => {
            p.reviews.forEach(r => {
                const images = r.images || [];
                const videos = r.videos || [];
                
                images.forEach((img, idx) => {
                    if (img.startsWith('data:')) {
                        console.log(`\n[BASE64 IMAGE FOUND]`);
                        console.log(`Product: ${p.name}`);
                        console.log(`Review By: ${r.name}`);
                        console.log(`Comment: ${r.comment}`);
                        console.log(`Image Index: ${idx}`);
                        console.log(`Base64 Snippet: ${img.substring(0, 50)}...`);
                        base64Found = true;
                    }
                });

                videos.forEach((vid, idx) => {
                    if (vid.startsWith('data:')) {
                        console.log(`\n[BASE64 VIDEO FOUND]`);
                        console.log(`Product: ${p.name}`);
                        console.log(`Review By: ${r.name}`);
                        console.log(`Comment: ${r.comment}`);
                        console.log(`Video Index: ${idx}`);
                        console.log(`Base64 Snippet: ${vid.substring(0, 50)}...`);
                        base64Found = true;
                    }
                });
            });
        });

        if (!base64Found) {
            console.log("No base64 media found in any reviews.");
        }

        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

checkBase64();
