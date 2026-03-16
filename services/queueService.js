const redis = require('../config/redis');
const logger = require('../utils/logger');
const { sendEmail } = require('../utils/emailUtils');
const { getOrderConfirmationTemplate } = require('../utils/emailTemplates');
const Order = require('../models/Order');

// Create Email Queue
const emailQueue = new Queue('email-queue', { connection: redis });

// Logger Worker (Example Process)
const emailWorker = new Worker('email-queue', async (job) => {
  const { type, data } = job.data;
  logger.info(`[WORKER] Processing ${type} for ${data.email}`);
  
  if (type === 'order-confirmation') {
    const order = await Order.findById(data.orderId);
    if (!order) return;

    await sendEmail({
      type: 'press',
      email: data.email,
      subject: `Order Confirmed - #${order._id}`,
      html: getOrderConfirmationTemplate({
        ...order.toObject(),
        user: data.user
      })
    });
  }
}, { connection: redis });

emailWorker.on('completed', (job) => logger.info(`[WORKER] Job ${job.id} completed`));
emailWorker.on('failed', (job, err) => logger.error(`[WORKER] Job ${job.id} failed: ${err.message}`));

module.exports = { emailQueue };
