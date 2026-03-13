require("dotenv").config();

const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const { Server } = require("socket.io");
const path = require("path");

const logger = require("./utils/logger");
const vault = require("./config/vault");

// ============================
// 🔐 ENV VALIDATION (Fail Fast)
// ============================
const requiredEnv = ["MONGO_URI", "JWT_SECRET"];
requiredEnv.forEach((key) => {
  if (!vault[key] && !process.env[key]) {
    logger.error(`❌ Missing required environment variable: ${key}`);
    process.exit(1);
  }
});

// ============================
// 🚀 CREATE APP & SERVER
// ============================
const app = express();
const server = http.createServer(app);

// Enable "trust proxy" if behind a reverse proxy (Render, Heroku, etc.)
app.set("trust proxy", 1);

// ============================
// 🛡 SECURITY MIDDLEWARE
// ============================
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

app.use(compression());
app.use(express.json({ limit: "100mb" }));

// ============================
// 🚦 RATE LIMITING
// ============================
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 15, // Limit each IP to 15 login/register attempts per hour
  message: "Too many attempts from this IP, please try again after an hour",
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api", apiLimiter);
app.use("/api/auth", authLimiter);

// ============================
// 🌍 CORS
// ============================
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "https://slook-store.vercel.app",
  "https://slook.luxury",
  "https://slook.onrender.com",
  "https://slook-339u.onrender.com",
  vault.CLIENT_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);

      const normalizedOrigin = origin.trim().toLowerCase();
      const isAllowed = allowedOrigins.some(o => o.trim().toLowerCase() === normalizedOrigin);

      if (isAllowed) {
        return callback(null, true);
      }

      logger.warn(`🚫 CORS BLOCKED | Origin: ${origin} | Allowed: ${allowedOrigins.join(', ')}`);
      return callback(new Error("CORS blocked"));
    },
    credentials: true,
  })
);

// ============================
// 📂 STATIC FILES (UPLOADS)
// ============================
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// --- HEALTH CHECK ---
app.get("/api/health", (req, res) => res.status(200).json({ status: "ok", timestamp: new Date() }));

// ============================
// ⏱️ PERFORMANCE MONITORING
// ============================
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 500) {
      logger.warn(`🐌 SLOW REQUEST | ${req.method} ${req.originalUrl} | ${duration}ms`);
    } else {
       logger.info(`⚡ REQUEST | ${req.method} ${req.originalUrl} | ${duration}ms`);
    }
  });
  next();
});

// ============================
// 📦 ROUTES
// ============================
app.use("/api/users", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/products", require("./routes/productRoutes"));
app.use("/api/orders", require("./routes/orderRoutes"));
app.use("/api/coupons", require("./routes/couponRoutes"));
app.use("/api/returns", require("./routes/returnRoutes"));
app.use("/api/reports", require("./routes/reportRoutes"));
app.use("/api/marketing", require("./routes/marketingRoutes"));
app.use("/api/looks", require("./routes/lookRoutes"));
app.use("/api/settings", require("./routes/settingsRoutes"));
app.use("/api/cart", require("./routes/cartRoutes"));
app.use("/api/wishlist", require("./routes/wishlistRoutes"));
app.use("/api/notifications", require("./routes/notificationRoutes"));
app.use("/api/payments", require("./routes/paymentRoutes"));
app.use("/api/support", require("./routes/supportRoutes"));
app.use("/api/blog", require("./routes/blogRoutes"));
app.use("/api/upload", require("./routes/uploadRoutes"));
app.use("/api/alerts", require("./routes/alertRoutes"));
app.use("/api/ai", require("./routes/aiRoutes"));
app.use("/", require("./routes/seoRoutes"));

// ============================
// ❤️ HEALTH CHECK
// ============================
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    uptime: process.uptime(),
    timestamp: Date.now(),
    dbStatus: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected"
  });
});

// ============================
// 🌍 SERVE FRONTEND (Catch-all for SPA)
// ============================
// Support for monorepo structure on Render
const buildPath = path.resolve(__dirname, "../client/dist");

// Serve static assets from the React build
app.use(express.static(buildPath));

// API 404 handler (Specialized for API)
app.use("/api", (req, res) => {
  res.status(404).json({ message: `API route ${req.originalUrl} not found` });
});

// React SPA Catch-all (Non-API GET requests)
app.use((req, res, next) => {
  // Only handle GET requests that don't start with /api
  if (req.method !== 'GET' || req.originalUrl.startsWith('/api')) {
    return next();
  }

  const indexFile = path.join(buildPath, "index.html");
  res.sendFile(indexFile, (err) => {
    if (err) {
      // If index.html is missing, we shouldn't keep trying to serve it for every request
      // We pass the error to the global handler
      console.error(`❌ SPA Catch-all Failed: ${req.originalUrl} | Path: ${indexFile} | Error: ${err.message}`);
      next(); 
    }
  });
});

// ============================
// 🌍 SOCKET.IO
// ============================
const io = new Server(server, {
  cors: { origin: "*" },
});

io.on("connection", (socket) => {
  logger.info(`🔌 Socket Connected: ${socket.id}`);

  socket.on('join-user-room', (userId) => {
    socket.join(userId);
    logger.info(`Socket ${socket.id} joined room: ${userId}`);
  });
});

app.set("socketio", io);

// ============================
// 🛡️ GLOBAL ERROR HANDLING
// ============================
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
app.use(notFound);
app.use(errorHandler);

// ============================
// 🗄 DATABASE CONNECTION
// ============================
async function connectDatabase() {
  try {
    await mongoose.connect(vault.MONGO_URI);
    logger.info("✅ MongoDB Connected");
  } catch (err) {
    logger.error("❌ MongoDB Connection Failed:", err.message);
    setTimeout(connectDatabase, 10000);
  }
}

// ============================
// 🚀 START SERVER
// ============================
const PORT = vault.PORT || 5005;

server.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  connectDatabase();

  try {
    const startCronJobs = require("./utils/cronJobs");
    startCronJobs();
  } catch (err) {
    logger.warn("⚠️ Cron jobs failed to start:", err.message);
  }
});

// ============================
// 🛑 GRACEFUL SHUTDOWN
// ============================
const shutdown = async (signal) => {
  logger.info(`${signal} received. Shutting down gracefully...`);
  server.close(async () => {
    logger.info("HTTP server closed.");
    await mongoose.connection.close();
    logger.info("MongoDB connection closed.");
    process.exit(0);
  });

  setTimeout(() => {
    logger.error("Could not close connections in time, forcefully shutting down");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("uncaughtException", (err) => {
  logger.error("🔥 UNCAUGHT EXCEPTION:", err);
});

process.on("unhandledRejection", (err) => {
  logger.error("🌊 UNHANDLED REJECTION:", err);
});
