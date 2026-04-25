const redis = require('../config/redis');
const logger = require('../utils/logger');

const cache = (duration = 300) => async (req, res, next) => {
  if (process.env.NODE_ENV !== 'production' && !process.env.ENABLE_CACHE) {
    return next();
  }

  const key = `__express__${req.originalUrl || req.url}`;
  
  try {
    let cachedResponse = null;
    if (redis && (redis.status === 'ready' || redis.status === 'connecting')) {
      try {
        cachedResponse = await redis.get(key);
      } catch (err) {
        logger.warn('Cache Get Failed (Redis Down):', err.message);
      }
    }

    if (cachedResponse) {
      return res.status(200).json(JSON.parse(cachedResponse));
    } else {
      res.sendResponse = res.json;
      res.json = (body) => {
        if (redis && redis.status === 'ready') {
          redis.set(key, JSON.stringify(body), 'EX', duration).catch(e => logger.warn('Cache Set Failed:', e.message));
        }
        res.sendResponse(body);
      };
      next();
    }
  } catch (error) {
    logger.error('Cache Middleware Error:', error);
    next();
  }
};

module.exports = cache;
