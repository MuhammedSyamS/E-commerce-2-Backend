const logger = require('../utils/logger');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');

// 1. HTTP Parameter Pollution Protection
const hpp = require('hpp');
const hppProtection = hpp();

// 2. Global Security Headers (Helmet)
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://checkout.stripe.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https://res.cloudinary.com", "https://*.amazonaws.com"],
      connectSrc: ["'self'", "https://api.stripe.com"],
      frameSrc: ["'self'", "https://checkout.stripe.com"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
});

// 3. Mongo Injection Protection
const sanitizeData = mongoSanitize();

// 4. Brute Force Lockout
const bruteForceLockout = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, 
  max: 50, 
  skipSuccessfulRequests: true,
  message: { success: false, message: 'Suspicious activity detected. Access restricted.' },
});

// 5. Global Error Handler (Prevents stack leaks)
const globalErrorHandler = (err, req, res, next) => {
  logger.error(`[SERVER ERROR] ${err.message}`);
  
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'An internal server error occurred' 
    : err.message;

  res.status(statusCode).json({
    success: false,
    message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack
  });
};

module.exports = {
  hppProtection,
  helmetConfig,
  sanitizeData,
  bruteForceLockout,
  globalErrorHandler
};
