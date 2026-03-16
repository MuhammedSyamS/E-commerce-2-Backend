require("dotenv").config();

const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const { Server } = require("socket.io");
const path = require("path");

const logger = require("./utils/logger");
const vault = require("./config/vault");

// ============================
// 🔐 ENV VALIDATION (Fail Fast)
// ============================
const requiredEnv = ["MONGO_URI", "JWT_SECRET", "GOOGLE_CLIENT_ID"];
requiredEnv.forEach((key) => {
  const val = vault[key] || process.env[key];
  if (!val) {
    logger.error(`❌ Missing required environment variable: ${key}`);
    process.exit(1);
  }
  // Log presence without value for security
  logger.info(`Vault check: ${key} is ${val ? 'PRESENT' : 'MISSING'}`);
});

// Build path validation
const buildPath = path.resolve(__dirname, "../client/dist");
const fs = require('fs');
if (!fs.existsSync(path.join(buildPath, "index.html"))) {
  logger.warn(`⚠️ FRONTEND BUILD MISSING: ${buildPath}/index.html not found!`);
} else {
  logger.info(`✅ Frontend build found at: ${buildPath}`);
}

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
    crossOriginOpenerPolicy: { policy: "unsafe-none" },
  })
);

app.use(compression());
app.use(express.json({ limit: "2mb" })); // Reduced from 100mb for security
app.use(mongoSanitize()); // Prevent NoSQL injection

// ============================
// 🚦 RATE LIMITING
// ============================
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict Auth Limiter: 5 attempts per minute
const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5,
  message: { message: "Too many login/register attempts. Please try again after a minute." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict Upload Limiter: 10 uploads per minute
const uploadLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10,
  message: { message: "Too many upload requests. Please try again after a minute." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api", apiLimiter);
app.use("/api/users/login", authLimiter);
app.use("/api/users/register", authLimiter);
app.use("/api/upload", uploadLimiter);
app.use("/api/looks", uploadLimiter); // Also limit looks upload

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

      // Dynamically add origins from vault.ALLOWED_ORIGINS
      const dynamicOrigins = vault.ALLOWED_ORIGINS 
        ? vault.ALLOWED_ORIGINS.split(',').map(o => o.trim().toLowerCase()) 
        : [];
      
      const allAllowed = [...allowedOrigins.map(o => o.trim().toLowerCase()), ...dynamicOrigins];
      const normalizedOrigin = origin.trim().toLowerCase();
      const isAllowed = allAllowed.includes(normalizedOrigin);

      if (isAllowed) {
        return callback(null, true);
      }

      logger.warn(`🚫 CORS BLOCKED | Origin: ${origin} | Allowed total: ${allAllowed.length}`);
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
  cors: { 
    origin: allowedOrigins,
    credentials: true
  },
});

io.on("connection", (socket) => {
  logger.info(`🔌 Socket Connected: ${socket.id}`);

  socket.on('join-user-room', (userId) => {
    socket.join(userId);
    logger.info(`Socket ${socket.id} joined room: ${userId}`);
  });

  // --- LIVE CHAT EVENTS ---
  socket.on('send-message', async (data) => {
    try {
      const User = require('./models/User');
      const ChatMessage = require('./models/ChatMessage');

      // Check if chat is enabled (only for customers) - Throttled check could be here but for now simple findById
      if (!data.isAdmin) {
        const user = await User.findById(data.userId).select('chatEnabledUntil');
        if (!user || !user.chatEnabledUntil || new Date() > user.chatEnabledUntil) {
          return socket.emit('chat-error', { message: 'Chat session expired or not active' });
        }
      }

      const msgData = {
        user: data.userId,
        sender: data.senderId,
        message: data.message,
        isAdmin: data.isAdmin || false,
        tempId: data.tempId
      };

      // Create and emit
      ChatMessage.create(msgData).then(async (msg) => {
        io.to(data.userId).emit('receive-message', msg);
        io.emit('admin-receive-message', msg); 

        // PERSISTENT NOTIFICATION FOR ADMINS (if sent by user)
        if (!data.isAdmin) {
          try {
            const Notification = require('./models/Notification');
            const User = require('./models/User');
            const adminUsers = await User.find({ role: 'admin' });
            
            // Just for the first message in a session or similar? 
            // The user asked for it "whenever", but we'll focus on notifying them of the "New Message".
            for (const admin of adminUsers) {
               await Notification.create({
                 user: admin._id,
                 title: "New Chat Message",
                 message: `Message from customer: ${data.message.substring(0, 30)}...`,
                 type: 'system',
                 data: { url: '/admin/support', userId: data.userId }
               });
            }
          } catch (err) { logger.error("Chat Admin Notif Fail") }
        }
      }).catch(err => logger.error('Chat DB Save Error:', err.message));
    } catch (err) {
      logger.error('Chat Error:', err.message);
    }
  });

  socket.on('typing', (data) => {
    io.to(data.userId).emit('user-typing', data);
  });
});

app.set("socketio", io);

// Add Chat Routes
app.use("/api/chat", require("./routes/chatRoutes"));

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
