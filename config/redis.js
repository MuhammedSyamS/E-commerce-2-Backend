const Redis = require('ioredis');
const logger = require('../utils/logger');

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// Heuristic to detect if we should allow falling back if Redis is missing
const isLocal = redisUrl.includes('127.0.0.1') || redisUrl.includes('localhost');

let redis;

try {
  redis = new Redis(redisUrl, {
    maxRetriesPerRequest: null, // Required for BullMQ
    lazyConnect: true, // Don't connect immediately
    enableOfflineQueue: false, // Don't hang requests if Redis is down
    retryStrategy: (times) => {
      if (times > 3 && isLocal) {
        logger.warn('🚫 Redis connection skipped (Local Dev Mode)');
        return null; // Stop retrying
      }
      return Math.min(times * 50, 2000);
    },
    connectTimeout: 5000,
  });

  redis.on('connect', () => logger.info('✅ Redis Connected'));
  
  let lastErrorTime = 0;
  redis.on('error', (err) => {
    const now = Date.now();
    if (now - lastErrorTime > 30000) {
      if (isLocal && err.code === 'ECONNREFUSED') {
         logger.warn(`⚠️ Redis Not Found (Local Dev): Server will function without caching/queues.`);
      } else {
         logger.error(`❌ Redis Error: ${err.message}`);
      }
      lastErrorTime = now;
    }
  });

} catch (err) {
  logger.error('💥 Critical Redis Init Failure:', err.message);
  // Fallback to a mock object so existing code doesn't throw immediate errors
  redis = {
    on: () => {},
    get: async () => null,
    set: async () => null,
    del: async () => null,
    quit: async () => null,
  };
}

module.exports = redis;
