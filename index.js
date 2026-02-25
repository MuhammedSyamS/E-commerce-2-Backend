require("dotenv").config();
const logger = require("./utils/logger");
const vault = require("./config/vault");

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

// Route imports
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const productRoutes = require("./routes/productRoutes");
const orderRoutes = require("./routes/orderRoutes");
const couponRoutes = require("./routes/couponRoutes");
const returnRoutes = require("./routes/returnRoutes");
const reportRoutes = require("./routes/reportRoutes");
const marketingRoutes = require("./routes/marketingRoutes");
const lookRoutes = require("./routes/lookRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const cartRoutes = require("./routes/cartRoutes");
const wishlistRoutes = require("./routes/wishlistRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const supportRoutes = require("./routes/supportRoutes");
const blogRoutes = require("./routes/blogRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const alertRoutes = require("./routes/alertRoutes");
const aiRoutes = require("./routes/aiRoutes");
const seoRoutes = require("./routes/seoRoutes");

const app = express();
const server = http.createServer(app);

// =======================
// 🔐 SECURITY MIDDLEWARE
// =======================
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

app.use(compression());

app.use(express.json({ limit: "50mb" }));

// =======================
// 🚦 RATE LIMITING
// =======================
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
});

app.use("/api", apiLimiter);

// =======================
// 🌍 CORS
// =======================
const allowedOrigins = [
  "http://localhost:5173",
  "https://slook-store.vercel.app",
  vault.CLIENT_URL,
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (!allowedOrigins.includes(origin)) {
        return callback(new Error("Not allowed by CORS"));
      }
      return callback(null, true);
    },
    credentials: true,
  })
);

// =======================
// 📂 ROUTES
// =======================
app.use('/api/users', authRoutes); // Auth (Login/Register)
app.use('/api/users', userRoutes); // User Profile & Management
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/returns', returnRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/marketing', marketingRoutes);
app.use('/api/looks', lookRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/ai', aiRoutes);
app.use('/', seoRoutes);

// Make uploads folder static
app.use('/uploads', express.static(path.join(__dirname, '/uploads')));

app.get("/", (req, res) => {
  res.status(200).send("SLOOK API Running");
});

// =======================
// 🔌 SOCKET.IO
// =======================
const io = new Server(server, {
  cors: { origin: "*" },
});

io.on("connection", (socket) => {
  logger.info(`Socket connected: ${socket.id}`);
});

app.set("socketio", io);

// =======================
// 🚀 START SERVER FIRST
// =======================
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  logger.info(`✅ Server running on port ${PORT}`);

  // Connect DB AFTER server starts
  connectDatabase();
});

// =======================
// 🗄 DATABASE CONNECTION
// =======================
async function connectDatabase() {
  try {
    await mongoose.connect(vault.MONGO_URI);
    logger.info("✅ MongoDB Connected");
  } catch (error) {
    logger.error("❌ MongoDB Connection Failed:", error.message);

    // Retry every 10 seconds instead of killing server
    setTimeout(connectDatabase, 10000);
  }
}