const { z } = require('zod');

const trackOrderSchema = z.object({
  orderId: z.string().trim().min(1, 'Order ID is required'),
  email: z.string().trim().email('Invalid email address'),
});

module.exports = {
  trackOrderSchema
};
