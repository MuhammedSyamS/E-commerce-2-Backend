const rateLimit = require('express-rate-limit');
const redis = require('../config/redis');
const logger = require('../utils/logger');

let RedisStore;
try {
  RedisStore = require('rate-limit-redis');
} catch (err) {
  logger.warn('⚠️  rate-limit-redis not found. Falling back to MemoryStore.');
}

// Heuristic to check if Redis is a mock or a real client
const isRedisConnected = redis && typeof redis.on === 'function' && !redis.isMock && RedisStore;

const createLimiter = (windowMinutes, maxRequests, message) => {
  const options = {
    windowMs: windowMinutes * 60 * 1000,
    max: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message },
    handler: (req, res, next, options) => {
      logger.warn(`🚫 Rate limit exceeded: ${req.ip} -> ${req.originalUrl}`);
      res.status(options.statusCode).send(options.message);
    }
  };

  if (isRedisConnected && RedisStore) {
    options.store = new RedisStore({
      // @ts-ignore
      sendCommand: (...args) => redis.call(...args),
      prefix: 'rl:',
    });
  }

  return rateLimit(options);
};

// --- ENTERPRISE LIMITS ---
const loginLimiter = createLimiter(1, 5, 'Too many login attempts. Please wait 1 minute.');
const registerLimiter = createLimiter(1, 3, 'Too many registration attempts. Please wait 1 minute.');
const otpLimiter = createLimiter(10, 3, 'Too many OTP requests. Please wait 10 minutes.');
const orderLimiter = createLimiter(1, 20, 'Order velocity too high. Please wait.');
const paymentLimiter = createLimiter(1, 10, 'Payment attempts throttled. Please wait.');
const globalApiLimiter = createLimiter(1, 100, 'Global API rate limit reached.');

module.exports = {
  loginLimiter,
  registerLimiter,
  otpLimiter,
  orderLimiter,
  paymentLimiter,
  globalApiLimiter
};
