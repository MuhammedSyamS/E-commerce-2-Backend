const { z } = require('zod');

/**
 * Middleware for validating request data using Zod
 * @param {z.ZodSchema} schema - The Zod schema to validate against
 * @param {string} source - Where to look for data: 'body', 'query', or 'params'
 */
const validate = (schema, source = 'body') => (req, res, next) => {
  try {
    const data = req[source];
    const parsed = schema.parse(data);
    // Replace req data with parsed/transformed data
    req[source] = parsed;
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      return res.status(400).json({ 
        success: false, 
        message: 'Validation Failed', 
        errors: errorMessages 
      });
    }
    next(error);
  }
};

module.exports = validate;
