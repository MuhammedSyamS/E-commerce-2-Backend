const logger = require('../utils/logger');
const Sentry = require('@sentry/node');

const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

const errorHandler = (err, req, res, next) => {
  // Respect the error object's status if it exists, otherwise use res.statusCode or default to 500
  let statusCode = err.status || err.statusCode || 500;
  
  if (res.headersSent) {
      return next(err);
  }

  // Handle express-rate-limit error object structure
  if (err.message === 'Too many requests') {
      statusCode = 429;
  }

  // Log the error using the winston logger
  logger.error(`[${statusCode}] ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
  
  // Capture critical errors in Sentry
  if (statusCode >= 500) {
    Sentry.captureException(err);
  }

  if (err.stack && process.env.NODE_ENV !== 'production') {
    logger.debug(err.stack);
  }

  res.status(statusCode).json({
    message: err.message || "Internal Server Error",
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};

module.exports = { notFound, errorHandler };
