require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// --- IMPORT ROUTE FILES ---
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const returnRoutes = require('./routes/returnRoutes'); // NEW
// const wishlistRoutes = require('./routes/wishlistRoutes'); // Deprecated?
const cartRoutes = require('./routes/cartRoutes');
const userRoutes = require('./routes/userRoutes');
const marketingRoutes = require('./routes/marketingRoutes');
const reportRoutes = require('./routes/reportRoutes'); // NEW
// const uploadRoutes = require('./routes/uploadRoutes');


const app = express(); // 1. THIS MUST COME BEFORE APP.USE

// --- MIDDLEWARE ---
app.use(express.json({ limit: '50mb' })); // Increase payload limit for Base64 images
app.use(cors());


// --- DATABASE CONNECTION ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Highphaus MongoDB Connected Successfully'))
  .catch(err => {
    console.error('Database Connection Error:', err.message);
    process.exit(1);
  });

// --- ROUTES ---
app.use('/api/auth', authRoutes); // Reverting to /api/auth if frontend uses it, or keep /api/users if that was intentional. 
// Step 1525 showed: app.use('/api/users', authRoutes); app.use('/api/users', userRoutes);
// This means both auth and user routes are under /api/users.
app.use('/api/users', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/returns', returnRoutes); // NEW MODULE
app.use('/api/reports', reportRoutes); // NEW
app.use('/api/marketing', marketingRoutes);
// app.use('/api/reports', reportRoutes); // Removed duplicate
app.use('/api/settings', require('./routes/settingsRoutes')); // NEW
app.use('/api/cart', cartRoutes);
app.use('/api/notifications', require('./routes/notificationRoutes')); // NEW
app.use('/api/payments', require('./routes/paymentRoutes')); // RAZORPAY
const uploadRoutes = require('./routes/uploadRoutes');
const path = require('path');

// ...

app.use('/api/notifications', require('./routes/notificationRoutes')); // NEW
app.use('/api/upload', uploadRoutes); // NEW

// Make uploads folder static
app.use('/uploads', express.static(path.join(__dirname, '/uploads')));

// --- BASE ROUTE ---
app.get('/', (req, res) => {
  res.send('Highphaus API is running...');
});

// --- CRON JOBS ---
const startCronJobs = require('./utils/cronJobs');
startCronJobs();

// --- GLOBAL ERROR HANDLING ---
app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});

// --- SERVER START ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});