const redis = require('../config/redis');
const logger = require('../utils/logger');

const cache = (ttlSeconds = 3600) => async (req, res, next) => {
  if (process.env.NODE_ENV !== 'production' || req.method !== 'GET') {
    return next();
  }

  const key = `cache:${req.originalUrl}`;
  
  try {
    const cachedData = await redis.get(key);
    if (cachedData) {
      // logger.info(`⚡ Cache Hit: ${key}`);
      return res.json(JSON.parse(cachedData));
    }

    // Intercept res.json to cache the response
    const originalJson = res.json;
    res.json = (data) => {
      redis.set(key, JSON.stringify(data), 'EX', ttlSeconds);
      return originalJson.call(res, data);
    };

    next();
  } catch (err) {
    logger.error(`❌ Cache Middleware Error: ${err.message}`);
    next();
  }
};

const clearCache = async (pattern) => {
  try {
    const keys = await redis.keys(`cache:${pattern}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
      logger.info(`🧹 Cache Cleared: ${pattern}`);
    }
  } catch (err) {
    logger.error(`❌ Cache Clear Error: ${err.message}`);
  }
};

module.exports = { cache, clearCache };
