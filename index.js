// SLOOK SERVER - AI ACTIVE
console.log("🔥 SLOOK SERVER STARTING...");
require("dotenv").config();

const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
const compression = require("compression");
const Sentry = require("@sentry/node");
const { Server } = require("socket.io");
const path = require("path");
const cookieParser = require("cookie-parser");

const logger = require("./utils/logger");
const vault = require("./config/vault");
const redis = require("./config/redis");
const { 
  hppProtection, 
  helmetConfig, 
  sanitizeData, 
  bruteForceLockout, 
  globalErrorHandler 
} = require('./middleware/securityShield');
const { getMetrics } = require("./metrics");

// ============================
// ENV VALIDATION
// ============================
const requiredEnv = ["MONGO_URI", "JWT_SECRET"];
requiredEnv.forEach((key) => {
  if (!vault[key] && !process.env[key]) {
    logger.error(`❌ Missing required environment variable: ${key}`);
    process.exit(1);
  }
});

// ============================
// CREATE APP
// ============================
const app = express();
const server = http.createServer(app);

// Sentry Init
Sentry.init({
  dsn: process.env.SENTRY_DSN || "",
  tracesSampleRate: 0.0, 
});

// ============================
// MIDDLEWARES
// ============================
app.set("trust proxy", 1);
app.use(helmetConfig);
app.use(cookieParser());
app.use(compression());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(sanitizeData);
app.use(hppProtection);

// CORS Config
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "http://localhost:5173",
  "https://slook-store.vercel.app",
  vault.CLIENT_URL,
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || process.env.NODE_ENV !== "production") return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));

// Performance Monitor
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 500) logger.warn(`🐢 SLOW ENDPOINT: ${req.method} ${req.originalUrl} [${duration}ms]`);
  });
  next();
});

// Rate Limiting
const { globalApiLimiter } = require("./middleware/rateLimiter");
app.use("/api", globalApiLimiter);

// ============================
// ROUTES
// ============================
// Health Check (Top priority)
app.get("/api/health", async (req, res) => {
  const os = require('os');
  let redisStatus = "Disconnected";
  try {
    const ping = await redis.ping();
    if (ping === "PONG") redisStatus = "Connected";
  } catch (err) {}

  res.status(200).json({
    status: "OK",
    environment: process.env.NODE_ENV,
    uptime: process.uptime(),
    dbStatus: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
    redisStatus,
    system: {
      memory: {
        total: Math.round(os.totalmem() / 1024 / 1024) + 'MB',
        free: Math.round(os.freemem() / 1024 / 1024) + 'MB'
      },
      load: os.loadavg()
    }
  });
});

app.get("/metrics", getMetrics);

app.use("/api/users", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/products", require("./routes/productRoutes"));
app.use("/api/orders", require("./routes/orderRoutes"));
app.use("/api/cart", require("./routes/cartRoutes"));
app.use("/api/wishlist", require("./routes/wishlistRoutes"));
app.use("/api/coupons", require("./routes/couponRoutes"));
app.use("/api/reports", require("./routes/reportRoutes"));
app.use("/api/marketing", require("./routes/marketingRoutes"));
app.use("/api/returns", require("./routes/returnRoutes"));
app.use("/api/invoices", require("./routes/invoiceRoutes"));
app.use("/api/looks", require("./routes/lookRoutes"));
app.use("/api/notifications", require("./routes/notificationRoutes"));
app.use("/api/payments", require("./routes/paymentRoutes"));
app.use("/api/support", require("./routes/supportRoutes"));
app.use("/api/blog", require("./routes/blogRoutes"));
app.use("/api/upload", require("./routes/uploadRoutes"));
app.use("/api/alerts", require("./routes/alertRoutes"));
app.use("/api/ai", require("./routes/aiRoutes"));
app.use("/api/chat", require("./routes/chatRoutes"));
app.use("/api/settings", require("./routes/settingsRoutes"));

app.use("/api", (req, res) => {
  res.status(404).json({ message: `API route ${req.originalUrl} not found` });
});

// ============================
// ERROR HANDLING
// ============================
app.use(globalErrorHandler);

// ============================
// DATABASE & SERVER
// ============================
const PORT = vault.PORT || 5005;

async function start() {
  try {
    await mongoose.connect(vault.MONGO_URI);
    logger.info("✅ MongoDB Connected");
    
    server.listen(PORT, "0.0.0.0", () => {
      logger.info(`🚀 API Server running on port ${PORT}`);
      // Start Socket.io logic...
    });
  } catch (err) {
    logger.error("❌ Startup Failed:", err.message);
    process.exit(1);
  }
}

// Socket.io Integration
const io = new Server(server, {
  cors: { origin: allowedOrigins, credentials: true }
});
io.on("connection", (socket) => {
  socket.on("join-user-room", (userId) => socket.join(userId));
});
app.set("socketio", io);

start();
