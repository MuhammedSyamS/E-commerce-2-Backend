const logger = require('../utils/logger');

const validate = (schema) => (req, res, next) => {
  try {
    const { body, params, query } = req;
    
    // Validate request structure
    const validated = schema.parse({
      body,
      params,
      query
    });

    // Replace request parts with validated and sanitized data
    req.body = validated.body;
    req.params = validated.params;
    req.query = validated.query;

    next();
  } catch (err) {
    logger.warn(`❌ Validation failed for ${req.originalUrl}: ${err.message}`);
    return res.status(400).json({
      success: false,
      message: 'VALIDATION_ERROR',
      errors: err.errors || err.message
    });
  }
};

module.exports = validate;
