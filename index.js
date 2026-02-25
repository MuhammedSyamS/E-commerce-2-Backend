require('dotenv').config();
const logger = require('./utils/logger');
const vault = require('./config/vault');
logger.info("SERVER STARTUP: Loading Environment via Vault...");

// --- GLOBAL PROCESS ERROR HANDLERS ---
process.on('uncaughtException', (err) => {
  logger.error('🔥 UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('🌊 UNHANDLED REJECTION:', reason);
});

logger.info("RAZORPAY_KEY_ID Loaded: %s", vault.RAZORPAY_KEY_ID ? "YES (" + vault.RAZORPAY_KEY_ID.substring(0, 5) + "...)" : "NO");
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
// Security Headers
const helmet = require('helmet');
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" } // Allow images to be loaded from frontend
}));

// GZIP Compression
const compression = require('compression');
app.use(compression());

// Rate Limiting
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 login/register attempts per hour
  message: "Too many attempts from this IP, please try again after an hour",
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', limiter);
app.use('/api/auth', authLimiter); // Protect auth routes

app.use(express.json({ limit: '50mb' }));

// TIGHTEN CORS for PROD
const allowedOrigins = [
  'http://localhost:5173', // Local Dev
  'https://slook.luxury', // Primary Production
  'https://slook-store.vercel.app', // Fallback
  vault.CLIENT_URL // Dynamic Deployment URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));


// --- DATABASE CONNECTION ---
mongoose.connect(vault.MONGO_URI)
  .then(() => logger.info('SLOOK MongoDB Connected Successfully'))
  .catch(err => {
    logger.error('Database Connection Error: %s', err.message);
    process.exit(1);
  });

// --- ROUTES ---
app.use('/api/auth', authRoutes); // Reverting to /api/auth if frontend uses it, or keep /api/users if that was intentional. 
// Step 1525 showed: app.use('/api/users', authRoutes); app.use('/api/users', userRoutes);
// This means both auth and user routes are under /api/users.
app.use('/api/users', authRoutes);
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/coupons', require('./routes/couponRoutes')); // New Coupon Route
app.use('/api/returns', returnRoutes); // NEW MODULE
app.use('/api/reports', reportRoutes); // NEW
app.use('/api/marketing', marketingRoutes);
app.use('/api/looks', require('./routes/lookRoutes'));
// app.use('/api/reports', reportRoutes); // Removed duplicate
app.use('/api/settings', require('./routes/settingsRoutes')); // NEW
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', require('./routes/wishlistRoutes')); // Re-enabled
app.use('/api/notifications', require('./routes/notificationRoutes')); // NEW
app.use('/api/payments', require('./routes/paymentRoutes')); // RAZORPAY
const uploadRoutes = require('./routes/uploadRoutes');
const path = require('path');

// ...

// app.use('/api/notifications', require('./routes/notificationRoutes')); // Removed Duplicate
app.use('/api/support', require('./routes/supportRoutes')); // NEW SUPPORT SYSTEM
app.use('/api/blog', require('./routes/blogRoutes')); // NEW BLOG SYSTEM
app.use('/api/upload', uploadRoutes); // NEW
app.use('/api/alerts', require('./routes/alertRoutes')); // NEW Phase 12
app.use('/api/ai', require('./routes/aiRoutes')); // NEW Phase 11
app.use('/', require('./routes/seoRoutes')); // ROBOTS & SITEMAP (at root)

// Make uploads folder static
app.use('/uploads', express.static(path.join(__dirname, '/uploads')));

// --- BASE ROUTE ---
app.get('/', (req, res) => {
  res.send('SLOOK API is running...');
});

// --- CRON JOBS ---
const startCronJobs = require('./utils/cronJobs');
startCronJobs();

// --- GLOBAL ERROR HANDLING ---
app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    message: err.message,
    stack: vault.NODE_ENV === 'production' ? null : err.stack,
  });
});

// --- SOCKET.IO SETUP ---
const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all for now, lock down in prod
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  logger.info('New Socket Connection: %s', socket.id);

  socket.on('join-user-room', (userId) => {
    socket.join(userId);
    logger.info('Socket %s joined room: %s', socket.id, userId);
  });

  socket.on('disconnect', () => {
    logger.info('Socket Disconnected: %s', socket.id);
  });
});

// Make io accessible to our router
app.set('socketio', io);

// --- SERVER START ---
const PORT = vault.PORT;

server.listen(PORT, '0.0.0.0', () => {
  logger.info(`✅ Server running on port ${PORT}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    logger.error(`❌ Port ${PORT} is busy. Please close other server terminals!`);
    process.exit(1);
  } else {
    logger.error('❌ Server startup error:', err);
    process.exit(1);
  }
});
