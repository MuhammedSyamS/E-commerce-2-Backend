const { Queue, Worker } = require('bullmq');
const redis = require('../config/redis');
const logger = require('../utils/logger');
const sendEmail = require('../utils/sendEmail');
const { getOrderConfirmationTemplate } = require('../utils/emailTemplates');
const Order = require('../models/Order');

let emailQueue;

// Check if Redis is actually connected before initializing BullMQ
// BullMQ with maxRetriesPerRequest: null will hang indefinitely if Redis is down
const redisStatus = redis.status;
const redisAvailable = redisStatus === 'ready' || redisStatus === 'connect' || redisStatus === 'connecting';

if (!redisAvailable) {
  logger.warn('⚠️ BullMQ skipped — Redis not available. Queues disabled.');
  emailQueue = {
    add: async () => {
      logger.warn('🚫 Queue.add called but Redis is unavailable.');
      return null;
    }
  };
} else {
  try {
    emailQueue = new Queue('email-queue', { 
      connection: redis,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
      }
    });

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
    }, { 
      connection: redis,
    });

    emailWorker.on('completed', (job) => logger.info(`[WORKER] Job ${job.id} completed`));
    emailWorker.on('failed', (job, err) => logger.error(`[WORKER] Job ${job?.id} failed: ${err.message}`));
    emailWorker.on('error', (err) => {
      logger.error(`[WORKER] Global Error: ${err.message}`);
    });

  } catch (err) {
    logger.warn('⚠️ BullMQ Initialization Failed (likely missing Redis). Queues will be disabled.');
    emailQueue = {
      add: async () => { 
        logger.warn('🚫 Queue.add called but Redis is unavailable.'); 
        return null; 
      }
    };
  }
}

module.exports = { emailQueue };
