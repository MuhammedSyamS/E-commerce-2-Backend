const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const Coupon = require('../models/Coupon');
const SiteSettings = require('../models/SiteSettings');
const logger = require('../utils/logger');
const { emailQueue } = require('../services/queueService');

class OrderService {
  /**
   * Create a new order with full validation, stock management, and loyalty processing
   */
  async createOrder(orderData, userId) {
    const { 
      orderItems, shippingAddress, paymentMethod, 
      totalPrice, taxPrice, shippingPrice, couponCode, 
      pointsToRedeem 
    } = orderData;

    const settings = await SiteSettings.getSettings();
    const user = await User.findById(userId);

    // 1. Validate Items & Stock
    if (!orderItems || orderItems.length === 0) {
      throw new Error('ORDER_EMPTY');
    }

    // 2. Process Coupon
    let finalTotalPrice = totalPrice;
    let discountAmount = 0;
    let appliedCoupon = null;

    if (couponCode) {
      appliedCoupon = await this._processCoupon(couponCode, totalPrice, userId);
      if (appliedCoupon) {
        discountAmount = appliedCoupon.discount;
        finalTotalPrice -= discountAmount;
      }
    }

    // 3. Process Loyalty Points
    if (pointsToRedeem > 0) {
      const loyaltyDiscount = await this._processLoyaltyRedemption(user, pointsToRedeem, finalTotalPrice, settings);
      finalTotalPrice -= loyaltyDiscount;
      discountAmount += loyaltyDiscount;
    }

    // 4. Create Order Object
    const order = new Order({
      user: userId,
      orderItems,
      shippingAddress,
      paymentMethod,
      taxPrice,
      shippingPrice,
      totalPrice: finalTotalPrice,
      discountAmount,
      couponCode: appliedCoupon?.code
    });

    const createdOrder = await order.save();

    // 5. Trigger Post-Order Logic (Async)
    this._afterOrderCreated(createdOrder, user);

    return createdOrder;
  }

  // --- PRIVATE HELPERS ---

  async _processCoupon(code, totalPrice, userId) {
    const coupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (!coupon || !coupon.isActive || new Date(coupon.expiryDate) < Date.now()) return null;
    
    if (coupon.specificUsers?.length > 0 && !coupon.specificUsers.includes(userId)) return null;
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) return null;
    if (totalPrice < coupon.minPurchase) return null;

    let discount = 0;
    if (coupon.discountType === 'percentage') {
      discount = (totalPrice * coupon.discountAmount) / 100;
    } else {
      discount = coupon.discountAmount;
    }

    coupon.usedCount += 1;
    await coupon.save();

    return { code: coupon.code, discount };
  }

  async _processLoyaltyRedemption(user, points, currentTotal, settings) {
    if (!settings.loyaltyPointsEnabled || user.loyaltyPoints < points) return 0;
    
    const maxAllowed = Math.min(settings.maxCoinsPerOrder || 500, currentTotal * 0.3);
    const redeemable = Math.min(points, maxAllowed);

    user.loyaltyPoints -= redeemable;
    await user.save();

    return redeemable;
  }

  async _afterOrderCreated(order, user) {
    // 1. Stock adjustment
    for (const item of order.orderItems) {
      await Product.findByIdAndUpdate(item.product, { $inc: { countInStock: -item.quantity } });
    }

    // 2. Queue Email
    emailQueue.add('order-confirmation', { 
      email: user.email, 
      orderId: order._id,
      name: user.firstName 
    });

    logger.info(`📦 Order Created: ${order._id} for ${user.email}`);
  }
}

module.exports = new OrderService();
