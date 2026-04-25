const logger = require('../utils/logger');
const rateLimit = require('express-rate-limit');

let hpp;
try { hpp = require('hpp'); } catch (e) { logger.warn('⚠️ hpp not found.'); }

let csurf;
try { csurf = require('csurf'); } catch (e) { logger.warn('⚠️ csurf not found.'); }

// 1. HTTP Parameter Pollution Protection
const hppProtection = hpp ? hpp() : (req, res, next) => next();

// 2. CSRF Protection
const csrfProtection = csurf ? csurf({ 
  cookie: { 
    httpOnly: true, 
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  } 
}) : (req, res, next) => next();

// 3. Brute Force Lockout Escalation
// If a user fails too many times, lock their IP for 24 hours
const bruteForceLockout = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 50, // Total failed attempts per IP
  skipSuccessfulRequests: true,
  message: { success: false, message: 'Your IP has been flagged for suspicious activity. Access restricted for 24h.' },
  handler: (req, res, next, options) => {
    logger.error(`🔥 SECURITY ALERT: IP ${req.ip} has been blocked for 24h due to brute force attempts.`);
    res.status(options.statusCode).send(options.message);
  }
});

// 4. Suspicious Activity Logger
const activityLogger = (req, res, next) => {
  const suspiciousKeywords = ['<script>', 'DROP TABLE', 'UNION SELECT', '../'];
  const bodyString = JSON.stringify(req.body);
  
  if (suspiciousKeywords.some(key => bodyString.includes(key))) {
    logger.warn(`🛑 SUSPICIOUS ACTIVITY DETECTED: IP ${req.ip} -> ${req.originalUrl} | Payload: ${bodyString}`);
  }
  next();
};

module.exports = {
  hppProtection,
  csrfProtection,
  bruteForceLockout,
  activityLogger
};
