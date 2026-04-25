// SLOOK SERVER - AI ACTIVE
require("dotenv").config();

const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const Sentry = require("@sentry/node");
const { nodeProfilingIntegration } = require("@sentry/profiling-node");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");

const logger = require("./utils/logger");
const vault = require("./config/vault");
const redis = require("./config/redis");

let cookieParser;
try {
  cookieParser = require("cookie-parser");
} catch (err) {
  logger.warn("⚠️ cookie-parser not found. Cookie auth may not work correctly.");
}

// ============================
// ENV VALIDATION
// ============================

const requiredEnv = [
  "MONGO_URI",
  "JWT_SECRET",
  "GOOGLE_CLIENT_ID",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
];

requiredEnv.forEach((key) => {
  const val = vault[key] || process.env[key];

  if (!val) {
    logger.error(`❌ Missing required environment variable: ${key}`);
    process.exit(1);
  }
});

if (!process.env.REDIS_URL)
  logger.warn("⚠️ REDIS_URL not set – using default localhost");

if (!process.env.SENTRY_DSN)
  logger.warn("⚠️ SENTRY_DSN not set – monitoring disabled");

// ============================
// FRONTEND BUILD CHECK
// ============================

const buildPath = path.resolve(__dirname, "../client/dist");

if (!fs.existsSync(path.join(buildPath, "index.html"))) {
  logger.warn(`⚠️ FRONTEND BUILD MISSING: ${buildPath}/index.html not found`);
} else {
  logger.info(`✅ Frontend build found at: ${buildPath}`);
}

// ============================
// CREATE APP
// ============================

const app = express();
const server = http.createServer(app);

if (cookieParser) {
  app.use(cookieParser());
}

// ============================
// SENTRY
// ============================

Sentry.init({
  dsn: process.env.SENTRY_DSN || "",
  // Fully disabling profiling to eliminate any performance overhead
  tracesSampleRate: 0.0, 
});

// ============================
// SECURITY MIDDLEWARE
// ============================

app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://checkout.razorpay.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "https://res.cloudinary.com", "https://images.unsplash.com"],
        connectSrc: ["'self'", "https://api.razorpay.com", "https://lumberjack-cx.razorpay.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'self'", "https://api.razorpay.com"],
      },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  })
);

app.use(compression());
app.use(express.json({ limit: "1mb" })); // Tightened limit
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Security & Sanitization (Express 5 Compatible)
app.use((req, res, next) => {
  const sanitize = (obj) => {
    if (obj instanceof Object) {
      for (const key in obj) {
        if (typeof obj[key] === 'string') {
          // Basic XSS Protection: Escape special chars
          obj[key] = obj[key]
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
        }
        
        // MongoDB Injection Protection
        if (key.startsWith('$') || key.includes('.')) {
          delete obj[key];
        } else if (obj[key] instanceof Object) {
          sanitize(obj[key]);
        }
      }
    }
  };
  
  if (req.body) sanitize(req.body);
  if (req.params) sanitize(req.params);
  if (req.query) {
    const query = { ...req.query };
    sanitize(query);
    req.query = query;
  }
  next();
});

// Performance Monitor Middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 500) {
      logger.warn(`🐢 SLOW ENDPOINT: ${req.method} ${req.originalUrl} [${duration}ms]`);
    }
  });
  next();
});

// ============================
// RATE LIMITING (REDIS BACKED)
// ============================
const { 
  loginLimiter, registerLimiter, orderLimiter, 
  paymentLimiter, globalApiLimiter 
} = require("./middleware/rateLimiter");

app.use("/api", globalApiLimiter);
app.use("/api/users/login", loginLimiter);
app.use("/api/users/register", registerLimiter);
app.use("/api/orders", orderLimiter);
app.use("/api/payments", paymentLimiter);

// ============================
// CORS
// ============================

const originsFromEnv = vault.ALLOWED_ORIGINS ? vault.ALLOWED_ORIGINS.split(',') : [];

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "http://192.168.86.4:3001",
  "https://slook-store.vercel.app",
  "https://slook.luxury",
  vault.CLIENT_URL,
  ...originsFromEnv,
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || process.env.NODE_ENV !== "production") return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      logger.warn(`🚫 CORS BLOCKED: ${origin}`);
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// ============================
// STATIC FILES
// ============================

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ============================
// HEALTH CHECK
// ============================

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

// ============================
// ROUTES
// ============================

app.use("/api/users", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/products", require("./routes/productRoutes"));
app.use("/api/orders", require("./routes/orderRoutes"));
app.use("/api/cart", require("./routes/cartRoutes"));
app.use("/api/wishlist", require("./routes/wishlistRoutes"));
app.use("/api/coupons", require("./routes/couponRoutes"));
app.use("/api/invoices", require("./routes/invoiceRoutes"));
app.use("/api/returns", require("./routes/returnRoutes"));
app.use("/api/reports", require("./routes/reportRoutes"));
app.use("/api/marketing", require("./routes/marketingRoutes"));
app.use("/api/looks", require("./routes/lookRoutes"));
app.use("/api/settings", require("./routes/settingsRoutes"));
app.use("/api/notifications", require("./routes/notificationRoutes"));
app.use("/api/payments", require("./routes/paymentRoutes"));
app.use("/api/support", require("./routes/supportRoutes"));
app.use("/api/blog", require("./routes/blogRoutes"));
app.use("/api/upload", require("./routes/uploadRoutes"));
app.use("/api/alerts", require("./routes/alertRoutes"));
app.use("/api/ai", require("./routes/aiRoutes"));
app.use("/api/chat", require("./routes/chatRoutes"));
// app.use("/", require("./routes/seoRoutes")); // Commented out to prevent conflict with serve frontend

const { 
  hppProtection, bruteForceLockout, activityLogger 
} = require("./middleware/securityShield");
const { getMetrics } = require("./metrics");

app.use(hppProtection);
app.use(activityLogger);
app.use("/api/auth", bruteForceLockout); // Apply only to auth for now to prevent lockout issues elsewhere

// ============================
// METRICS
// ============================
app.get("/metrics", getMetrics);

// ============================
// SERVE FRONTEND
// ============================

app.use(express.static(buildPath));

app.use("/api", (req, res) => {
  res.status(404).json({ message: `API route ${req.originalUrl} not found` });
});

app.use((req, res, next) => {
  if (req.method !== "GET" || req.originalUrl.startsWith("/api")) {
    return next();
  }

  const indexFile = path.join(buildPath, "index.html");

  res.sendFile(indexFile, (err) => {
    if (err) next();
  });
});

// ============================
// SOCKET.IO
// ============================

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

io.on("connection", (socket) => {
  logger.info(`🔌 Socket Connected: ${socket.id}`);

  socket.on("join-user-room", (userId) => {
    socket.join(userId);
  });
});

app.set("socketio", io);

// ============================
// ERROR HANDLING
// ============================

const { notFound, errorHandler } = require("./middleware/errorMiddleware");

app.use(notFound);
app.use(errorHandler);

// ============================
// DATABASE CONNECTION
// ============================

async function connectDatabase() {
  try {
    await mongoose.connect(vault.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      maxPoolSize: 100, // Enterprise scale
      minPoolSize: 10,  // Warm connections ready
    });
    logger.info("✅ MongoDB Connected");
  } catch (err) {
    logger.error("❌ MongoDB Connection Failed:", err.message);
    process.exit(1);
  }
}

// ============================
// START SERVER
// ============================

const PORT = vault.PORT || 5005;

async function startServer() {
  await connectDatabase();

  server.listen(PORT, "0.0.0.0", () => {
    logger.info(`🚀 Server running on port ${PORT}`);

    try {
      const startCronJobs = require("./utils/cronJobs");
      startCronJobs();
    } catch (err) {
      logger.warn("⚠️ Cron jobs failed:", err.message);
    }
  });
}

startServer();

// ============================
// PORT ERROR HANDLING
// ============================

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    logger.error(`❌ Port ${PORT} already in use`);
    process.exit(1);
  }

  logger.error("🔥 Server error:", err);
});

// ============================
// GRACEFUL SHUTDOWN
// ============================

async function shutdown(signal) {
  logger.info(`${signal} received. Shutting down gracefully...`);

  server.close(async () => {
    try {
      await mongoose.connection.close();
      logger.info("📦 MongoDB connection closed.");
      
      await redis.quit();
      logger.info("⚡ Redis connection closed.");
      
      process.exit(0);
    } catch (err) {
      logger.error("❌ Shutdown Error:", err);
      process.exit(1);
    }
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("uncaughtException", (err) => {
  logger.error("🔥 UNCAUGHT EXCEPTION:", err);
});

process.on("unhandledRejection", (err) => {
  logger.error("🌊 UNHANDLED REJECTION:", err);
});
