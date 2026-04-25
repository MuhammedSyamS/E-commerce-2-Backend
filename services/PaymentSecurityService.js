const redis = require('../config/redis');
const logger = require('../utils/logger');
const crypto = require('crypto');

class PaymentSecurityService {
  /**
   * Verify Idempotency Key to prevent double order creation
   */
  async verifyIdempotency(key, userId) {
    if (!key) return true;
    
    const redisKey = `idempotency:${userId}:${key}`;
    const exists = await redis.get(redisKey);
    
    if (exists) {
      logger.warn(`⚠️ DUPLICATE REQUEST DETECTED: User ${userId} | Key ${key}`);
      return false;
    }

    // Set with 1-hour expiration
    await redis.set(redisKey, 'processed', 'EX', 3600);
    return true;
  }

  /**
   * Verify Razorpay Signature
   */
  verifyWebhookSignature(body, signature, secret) {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(body))
      .digest('hex');

    return expectedSignature === signature;
  }

  /**
   * Detect velocity-based fraud (e.g., 5 orders in 1 minute)
   */
  async detectVelocityFraud(userId) {
    const key = `velocity:${userId}`;
    const count = await redis.incr(key);
    
    if (count === 1) {
      await redis.expire(key, 60);
    }

    if (count > 5) {
      logger.error(`🚨 FRAUD ALERT: High velocity orders from User ${userId}`);
      return true;
    }
    return false;
  }
}

module.exports = new PaymentSecurityService();
