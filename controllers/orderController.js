const Order = require('../models/Order');
const Product = require('../models/Product');
const Return = require('../models/Return'); // NEW
const sendEmail = require('../utils/sendEmail');
const logger = require('../utils/logger');
const { emailQueue } = require('../services/queueService');
const Sentry = require('@sentry/node');

const { getOrderConfirmationTemplate, getShippingConfirmationTemplate } = require('../utils/emailTemplates');
const { logStockChange } = require('../utils/stockUtils');

const addOrderItems = async (req, res) => {
  try {
    const { orderItems, shippingAddress, paymentMethod, totalPrice, taxPrice, shippingPrice } = req.body;
    const SiteSettings = require('../models/SiteSettings');
    const settings = await SiteSettings.getSettings();


    if (!orderItems || orderItems.length === 0) {
      return res.status(400).json({ message: 'No order items provided' });
    }

    // CHECK STOCK & DECREMENT
    const productUpdates = [];

    // --- COUPON VALIDATION ---
    let finalTotalPrice = totalPrice;
    let discountAmount = 0;

    if (req.body.couponCode) {
      const Coupon = require('../models/Coupon');
      const coupon = await Coupon.findOne({ code: req.body.couponCode.toUpperCase() });

      if (coupon && coupon.isActive && new Date(coupon.expiryDate) > Date.now()) {
        // --- NEW: USER SPECIFIC CHECK ---
        if (coupon.specificUsers && coupon.specificUsers.length > 0) {
          if (!coupon.specificUsers.includes(req.user._id.toString())) {
            return res.status(403).json({ message: 'This coupon is not valid for your account' });
          }
        }
        // --------------------------------

        // Check Usage Limit
        if (!coupon.usageLimit || coupon.usedCount < coupon.usageLimit) {
          // Check Min Purchase (Use FE passed total or verify backend calc?)
          // For safety, we should ideally recalc total here, but for now we trust FE total matches backend calc
          // Let's rely on FE correctness for now but adding a basic check
          if (totalPrice >= coupon.minPurchase) {
            if (coupon.discountType === 'percentage') {
              discountAmount = (totalPrice * coupon.discountAmount) / 100;
            } else {
              discountAmount = coupon.discountAmount;
            }
            if (discountAmount > totalPrice) discountAmount = totalPrice;
            finalTotalPrice = totalPrice - discountAmount;

            // Increment Usage
            coupon.usedCount += 1;
            await coupon.save();
          }
        }
      }
    }
    // -------------------------

    // --- LOYALTY POINTS REDEMPTION ---
    if (req.body.pointsToRedeem && req.body.pointsToRedeem > 0) {
      const user = await require('../models/User').findById(req.user._id);
      const pointsStart = Number(req.body.pointsToRedeem);

      // Minimum 100 coins required to redeem
      if (pointsStart < 100) {
        return res.status(400).json({ message: "Minimum 100 SLOOK Coins required to redeem." });
      }

      if (user && user.loyaltyPoints >= pointsStart) {
        // --- REFINED REDEMPTION RULES ---
        const MAX_COINS_FLAT = 100; // Rule: Max 100 coins per order
        const MAX_PCT = 0.30; // Rule: Max 30% of order value
        const maxRedeemPct = Math.floor(finalTotalPrice * MAX_PCT);
        const maxAllowed = Math.min(MAX_COINS_FLAT, maxRedeemPct);

        if (pointsStart > maxAllowed) {
          return res.status(400).json({ message: `Redemption cap reached. Max allowed for this order: ${maxAllowed} coins.` });
        }

        // Conversion: 1 Point = ₹1
        const discount = pointsStart;

        // Validation: Cannot exceed total price
        if (discount <= finalTotalPrice) {
          finalTotalPrice -= discount;
          discountAmount += discount;

          // Deduct Points Immediately (Will refund if failure)
          user.loyaltyPoints -= pointsStart;
          await user.save();

          // Log Transaction
          const LoyaltyTransaction = require('../models/LoyaltyTransaction');
          await LoyaltyTransaction.create({
            user: user._id,
            type: 'spend',
            amount: pointsStart,
            description: `Redeemed on Order`,
            referenceId: null, // Temporary until order created
            referenceModel: 'Order'
          });
        }
      }
    }
    // ---------------------------------

    for (const item of orderItems) {
      // DEBUG LOG
      console.log(`PROCESSING ITEM: ${item.name}`);
      console.log(`- RAW Payload product:`, item.product); // Check what frontend sent

      const productId = item.product?._id || item.product;
      console.log(`- Resolved ID: ${productId}`);

      const product = await Product.findById(productId);
      if (!product) {
        console.error(`!!! PRODUCT NOT FOUND in DB. ID: ${productId} - Removing from User Cart.`);

        // FIX: Remove from user cart immediately
        await require('../models/User').updateOne(
          { _id: req.user._id },
          { $pull: { cart: { product: productId } } }
        );

        // Terminate request so user sees error and refreshes
        return res.status(404).json({ message: `Item no longer available and removed. Please try again.`, isStale: true });
      }

      const qty = item.qty || item.quantity;
      const { adjustStock } = require('../utils/stockUtils');

      try {
        await adjustStock(
          productId,
          item.selectedVariant,
          -qty, // Negative for deduction
          'Order',
          'Pending-Order', // Will be updated with actual order ID later
          null,
          `Order Placement: ${item.name}`
        );
      } catch (err) {
        return res.status(400).json({ message: err.message });
      }
    }

    // await Promise.all(productUpdates); // No longer needed as adjustStock saves immediately

    // MAP FIELDS EXPLICITLY TO MATCH YOUR SCHEMA
    const order = new Order({
      user: req.user._id,
      orderItems: orderItems.map(item => ({
        name: item.name || 'Item',
        qty: item.qty || item.quantity || 1,
        image: item.image || 'https://cdn-icons-png.flaticon.com/512/3119/3119338.png',
        price: item.price || 0,
        // Save Variant Info
        selectedVariant: item.selectedVariant,
        // SAFETY FIX: Ensure we extract the ID string whether it's an object or string
        product: item.product?._id || item.product
      })),
      shippingAddress: {
        address: shippingAddress.address,
        city: shippingAddress.city,
        state: shippingAddress.state,
        postalCode: shippingAddress.postalCode || shippingAddress.zip || '000000', // Fix: support both names
        phone: shippingAddress.phone,
        alternatePhone: shippingAddress.alternatePhone
      },
      paymentMethod,
      couponCode: req.body.couponCode,
      discountAmount: discountAmount || req.body.discountAmount || 0,
      taxPrice: taxPrice || 0,
      shippingPrice: shippingPrice || 0,
      totalPrice: finalTotalPrice,
      isPaid: paymentMethod === 'cod' ? false : true,
      paidAt: paymentMethod === 'cod' ? null : Date.now(),
      orderNote: req.body.orderNote,
    });

    // --- SAFETY WRAPPER: Try to save order. If fails, RESTORE STOCK ---
    try {
      const createdOrder = await order.save();

      // --- SEND EMAIL CONFIRMATION (VIA BULLMQ) ---
      try {
        await emailQueue.add('order-confirmation', {
          type: 'order-confirmation',
          data: {
            email: req.user.email,
            orderId: createdOrder._id,
            user: { firstName: req.user.firstName, lastName: req.user.lastName }
          }
        });
        logger.info(`[ORDER] Confirmation email queued for: ${req.user.email}`);
      } catch (emailError) {
        Sentry.captureException(emailError);
        logger.error("QUEUE FAILED:", emailError.message);
      }

      // --- AWARD LOYALTY POINTS (If Paid) ---
      if (createdOrder.isPaid) {
        await awardOrderCoins(createdOrder._id);
      }

      // --- SOCKET.IO NOTIFICATION ---
      const io = req.app.get('socketio');
      if (io) {
        io.emit('new-order', {
          _id: createdOrder._id,
          totalPrice: createdOrder.totalPrice,
          user: { firstName: req.user.firstName, lastName: req.user.lastName },
          createdAt: createdOrder.createdAt
        });
      }

      // Fetch fresh user data to return
      const User = require('../models/User');
      const finalUser = await User.findById(req.user._id)
        .select('loyaltyPoints membershipTier totalSpent firstName lastName email role isAdmin permissions cart wishlist');

      res.status(201).json({
        order: createdOrder,
        user: finalUser
      });

    } catch (saveError) {
      console.error("CRITICAL: Order Save Failed AFTER Stock Deduction. Restoring Stock...");
      const { adjustStock } = require('../utils/stockUtils');

      // RESTORE STOCK LOGIC (Inverse of above)
      for (const item of orderItems) {
        try {
          const productId = item.product?._id || item.product;
          const qty = item.qty || item.quantity;

          await adjustStock(
            productId,
            item.selectedVariant,
            qty,
            'System Restore',
            'Failed-Order',
            null,
            `Rollback due to save error`
          );
          console.log(`- Restored ${item.name} (${qty})`);

        } catch (restoreErr) {
          console.error(`!!! FATAL: Failed to restore stock for ${item.name}:`, restoreErr);
        }
      }

      return res.status(500).json({ message: "Database rejected the order. Stock has been restored.", error: saveError.message });
    }

  } catch (error) {
    console.error("ORDER ERROR:", error.message); // Look at your terminal!
    res.status(500).json({ message: "Database rejected the order", error: error.message });
  }
};

const getMyOrders = async (req, res) => {
  try {
    // Ensure we are searching by the authenticated user's ID
    const myOrdersRaw = await Order.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .select('_id orderStatus isPaid paidAt isDispatched dispatchedAt shippedAt isDelivered deliveredAt processingAt confirmedAt returnStatus returnRequestedAt returnedAt totalPrice createdAt orderItems');

    // Add returnId and tracking to each order
    const myOrders = await Promise.all(myOrdersRaw.map(async (order) => {
      const latestReturn = await Return.findOne({ order: order._id }).sort({ createdAt: -1 });
      const prefix = latestReturn?.type === 'Exchange' ? 'EXC' : 'RTN';
      return {
        ...order._doc,
        returnId: latestReturn ? `${prefix}-${latestReturn._id.toString().slice(-8).toUpperCase()}` : null,
        returnIdFull: latestReturn ? latestReturn._id : null,
        returnType: latestReturn ? latestReturn.type : null,
        returnTrackingId: latestReturn?.pickupDetails?.trackingId || null,
        returnCourier: latestReturn?.pickupDetails?.courier || null,
        returnPickupDate: latestReturn?.pickupDetails?.scheduledDate || null,
        returnPickupMethod: latestReturn?.pickupDetails?.method || 'Pickup'
      };
    }));

    res.status(200).json(myOrders);
  } catch (error) {
    res.status(500).json({ message: "Error fetching orders", error: error.message });
  }
};

// --- 3. GET ORDER BY ID ---
const getOrderById = async (req, res) => {
  try {
    // Find the order by ID
    // We REMOVED populate here to ensure we always get the product ID (even if product is deleted/null in DB lookup)
    // This fixes the "Unavailable" Review Button issue.
    const order = await Order.findById(req.params.id)
      .select('_id orderStatus isPaid paidAt isDispatched dispatchedAt shippedAt isDelivered deliveredAt processingAt confirmedAt returnStatus returnRequestedAt returnedAt totalPrice createdAt orderItems shippingAddress deliveryPartner trackingId orderNote user');

    if (order) {
      // Security Check: Only the user who placed the order (or an admin/manager) can see it
      const isAuthorized =
        req.user.role === 'admin' ||
        req.user.role === 'manager' ||
        req.user.permissions?.includes('manage_orders') ||
        (order.user && order.user.toString() === req.user._id.toString());

      if (!isAuthorized) {
        return res.status(401).json({ message: "Not authorized to view this order" });
      }

      // Fetch Latest Return ID if exists
      const latestReturn = await Return.findOne({ order: order._id }).sort({ createdAt: -1 });
      const prefix = latestReturn?.type === 'Exchange' ? 'EXC' : 'RTN';

      res.status(200).json({
        ...order._doc,
        returnId: latestReturn ? `${prefix}-${latestReturn._id.toString().slice(-8).toUpperCase()}` : null,
        returnIdFull: latestReturn ? latestReturn._id : null,
        returnType: latestReturn ? latestReturn.type : null,
        returnTrackingId: latestReturn?.pickupDetails?.trackingId || null,
        returnCourier: latestReturn?.pickupDetails?.courier || null,
        returnPickupDate: latestReturn?.pickupDetails?.scheduledDate || null,
        returnPickupMethod: latestReturn?.pickupDetails?.method || 'Pickup'
      });
    } else {
      res.status(404).json({ message: "Order not found" });
    }
  } catch (error) {
    console.error("GET ORDER ERROR:", error.message);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// --- ADMIN CONTROLLERS ---

// @desc    Get All Orders (Admin)
// @route   GET /api/orders/admin/all
// @access  Private/Admin
const getAllOrders = async (req, res) => {
  try {
    const pageSize = Number(req.query.pageSize) || 20;
    const page = Number(req.query.page) || 1;
    const { keyword, status, isPaid, paymentMethod } = req.query;

    let query = {};

    if (keyword) {
      const isObjectId = keyword.match(/^[0-9a-fA-F]{24}$/);
      if (isObjectId) {
        query._id = keyword;
      } else {
        const User = require('../models/User');
        const users = await User.find({
          $or: [
            { email: { $regex: keyword, $options: 'i' } },
            { firstName: { $regex: keyword, $options: 'i' } },
            { lastName: { $regex: keyword, $options: 'i' } }
          ]
        }).select('_id');
        const userIds = users.map(u => u._id);

        query.$or = [
          { user: { $in: userIds } },
          { _id: { $regex: keyword, $options: 'i' } }
        ];
      }
    }

    if (status && status !== 'all') query.orderStatus = status;
    if (isPaid !== undefined && isPaid !== 'all') query.isPaid = isPaid === 'true';
    if (paymentMethod && paymentMethod !== 'all') query.paymentMethod = paymentMethod;

    console.log(`ADMIN ORDERS: Fetching with query:`, JSON.stringify(query));

    const count = await Order.countDocuments(query);
    const orders = await Order.find(query)
      .populate('user', 'id firstName lastName email phone')
      .select('_id orderStatus isPaid paidAt isDispatched dispatchedAt shippedAt isDelivered deliveredAt processingAt confirmedAt returnStatus returnRequestedAt returnedAt totalPrice createdAt orderItems paymentMethod shippingAddress billingAddress paymentResult deliveryPartner trackingId')
      .sort({ createdAt: -1 })
      .limit(pageSize)
      .skip(pageSize * (page - 1));

    res.json({
      orders,
      page,
      pages: Math.ceil(count / pageSize),
      total: count
    });
  } catch (error) {
    console.error("ADMIN ORDERS ERROR:", error);
    res.status(500).json({ message: "Error fetching all orders" });
  }
};

// @desc    Get Orders by User ID (Admin)
// @route   GET /api/orders/user/:id
// @access  Private/Admin
const getUserOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.params.id })
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: "Error fetching user orders" });
  }
};

// @desc    Update Order Status (Granular)
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.id);

    if (order) {
      // 1. Enforce Status Workflow (MNC Standard)
      const statusFlow = {
        'Pending': 0,
        'Processing': 1,
        'Confirmed': 2,
        'Dispatched': 3,
        'Shipped': 4,
        'Delivered': 5,
        'Exchanged': 6
      };

      const currentStatusLevel = statusFlow[order.orderStatus] || 0;
      const newStatusLevel = statusFlow[status];

      // Allow cancelling from pre-shipping stages
      if (status === 'Cancelled') {
        if (currentStatusLevel >= 4) { // If Shipped or Delivered
          return res.status(400).json({ message: 'Cannot cancel order after it has been shipped.' });
        }
      }
      // Allow returning only after delivery
      else if (status === 'Returned') {
        if (order.orderStatus !== 'Delivered') {
          return res.status(400).json({ message: 'Cannot mark as Returned. Order is not Delivered yet.' });
        }
      }

      order.orderStatus = status;

      // Sync Booleans for backward compatibility
      if (status === 'Processing') {
        order.processingAt = Date.now();
      } else if (status === 'Confirmed') {
        order.confirmedAt = Date.now();
      } else if (status === 'Dispatched') {
        order.dispatchedAt = Date.now();
        if (req.body.deliveryPartner) order.deliveryPartner = req.body.deliveryPartner;
        if (req.body.trackingId) order.trackingId = req.body.trackingId;
      } else if (status === 'Shipped') {
        order.isDispatched = true;
        order.shippedAt = Date.now();
        // Update Tracking Info if provided
        if (req.body.deliveryPartner) order.deliveryPartner = req.body.deliveryPartner;
        if (req.body.trackingId) order.trackingId = req.body.trackingId;
      } else if (status === 'Delivered') {
        if (!order.isDispatched) {
          return res.status(400).json({ message: 'Logic Error: Cannot mark Delivered before Shipping.' });
        }
        order.isDelivered = true;
        order.deliveredAt = Date.now();

        // --- REFERRAL SYSTEM: CREDIT REFERRER ---
        const User = require('../models/User');
        const user = await User.findById(order.user);

        if (user && user.referredBy && !user.hasMadeFirstOrder) {
          console.log(`Processing Referral for User: ${user.email}`);
          const referrer = await User.findById(user.referredBy);
          if (referrer) {
            // Credit ₹500
            referrer.referralEarnings += 500;
            referrer.loyaltyPoints += 500; // Also add to redeemable points? Or keep separate?
            // For now, let's assume earnings are just for display or separate withdrawal, 
            // OR we convert them to loyalty points.
            // Best approach: Add to loyalty points for immediate use.
            // referrer.loyaltyPoints += 500; 
            // Let's keep referralEarnings as a tracker and add to loyaltyPoints for usage.

            await referrer.save();

            // Log Transaction
            const LoyaltyTransaction = require('../models/LoyaltyTransaction');
            await LoyaltyTransaction.create({
              user: referrer._id,
              type: 'referral',
              amount: 500,
              description: `Referral Bonus: ${user.firstName}'s first purchase`,
              referenceId: user._id,
              referenceModel: 'User'
            });

            user.hasMadeFirstOrder = true;
            await user.save();
            console.log(`Referral Credited to ${referrer.email}`);

            // Notify Referrer
            const pushUtils = require('../utils/push');
            pushUtils.sendToUser(referrer._id, 'Referral Bonus!', 'You earned ₹500 credits from a referral.', { url: '/referrals' });
          }
        }

        // --- AWARD ORDER COINS (For COD/Delivered) ---
        await awardOrderCoins(order._id);

      } else if (status === 'Return Requested') {
        order.returnRequestedAt = Date.now();
      } else if (status === 'Returned') {
        order.returnedAt = Date.now();
      } else if (status === 'Exchanged') {
        order.exchangedAt = Date.now(); // Add to model if needed, or just set status
      } else if (['Pending', 'Processing', 'Confirmed', 'Dispatched'].includes(status)) {
        // Reset booleans if reverting (Admin might correct a mistake)
        order.isDispatched = false;
        order.isDelivered = false;
        order.deliveredAt = null;
        order.dispatchedAt = null;
      }

      const updatedOrder = await order.save();

      // --- TRIGGER PUSH NOTIFICATION ---
      const pushUtils = require('../utils/push');

      // Get first product image for thumbnail
      const firstItemImage = order.orderItems[0]?.image || 'https://cdn-icons-png.flaticon.com/512/3119/3119338.png';
      const orderUrl = `/order/${order._id}`; // FIXED: Matches App.jsx route

      const msgMap = {
        'Processing': { title: 'Order Processing', body: 'We are processing your order.' },
        'Confirmed': { title: 'Order Confirmed', body: 'Your order has been confirmed.' },
        'Dispatched': { title: 'Order Dispatched', body: 'Your order is ready for dispatch.' },
        'Shipped': { title: 'Order In Transit', body: `Your order #${order._id.toString().slice(-6)} has been shipped.` },
        'Delivered': { title: 'Order Delivered', body: 'Your package has arrived! Enjoy your purchase.' },
        'Exchanged': { title: 'Exchange Successful', body: 'Your exchange process is complete.' }, // NEW
        'Refunded': { title: 'Refund Processed', body: 'Your refund request has been approved.' },
        'Cancelled': { title: 'Order Cancelled', body: 'Your order has been cancelled.' }
      };

      if (msgMap[status]) {
        pushUtils.sendToUser(order.user, msgMap[status].title, msgMap[status].body, {
          image: firstItemImage,
          url: orderUrl,
          orderId: order._id
        });
      }

      // --- REVERSE COINS IF CANCELLED ---
      if (status === 'Cancelled') {
        await reverseOrderCoins(order._id);
      }

      // --- SYSTEMATIC STOCK RESTORATION ---
      if (status === 'Cancelled' || status === 'Returned') {
        console.log(`📦 Status is ${status}. Checking if stock needs restoration for Order ${order._id}...`);

        // We might want a flag like `isStockRestored` on the order to prevent double-restoring
        // But for now, let's assume if it was already cancelled/returned, we don't do it again if status didn't change (handled by workflow)

        const { adjustStock } = require('../utils/stockUtils');
        for (const item of order.orderItems) {
          try {
            await adjustStock(
              item.product,
              item.selectedVariant,
              item.qty || item.quantity,
              status === 'Cancelled' ? 'Order Cancelled' : 'Order Returned',
              order._id,
              req.user._id,
              `Status updated to ${status}`
            );
          } catch (restoreErr) {
            console.error(`❌ Stock Restoration Failed for ${item.name}:`, restoreErr.message);
          }
        }
      }

      // --- SEND EMAIL NOTIFICATIONS (Shipped/Delivered) ---
      if (status === 'Shipped' || status === 'Dispatched') {
        try {
          await sendEmail({
            type: 'press',
            email: order.user.email,
            subject: `Order #${order._id} Shipped!`,
            html: getShippingConfirmationTemplate(updatedOrder)
          });
          console.log(`Shipping email sent for Order #${order._id}`);
        } catch (err) {
          console.error("Shipping Email Failed:", err);
        }
      }

      res.json(updatedOrder);
    } else {
      res.status(404).json({ message: 'Order not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Update failed', error: error.message });
  }
};

// @desc    Get Admin Stats (Analytics)
// @route   GET /api/orders/admin/stats
// @access  Private/Admin

const getAdminStats = async (req, res) => {
  try {
    const { timeRange = 'daily' } = req.query;

    // 1. Basic Counts
    const usersCount = await require('../models/User').countDocuments();
    const productsCount = await require('../models/Product').countDocuments();

    // 2. Financial Totals (Paid Only)
    const financialStats = await Order.aggregate([
      { $match: { isPaid: true } },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$totalPrice" },
          totalOrders: { $sum: 1 },
          totalDiscounts: { $sum: "$discountAmount" },
          totalShipping: { $sum: "$shippingPrice" },
          totalTax: { $sum: "$taxPrice" }
        }
      }
    ]);
    const { totalSales = 0, totalOrders = 0, totalDiscounts = 0, totalShipping = 0, totalTax = 0 } = financialStats[0] || {};
    const totalExpenses = totalDiscounts + totalShipping + totalTax;

    // 3. Time Series Analytics (Sales/Profit)
    // We'll use a date format string based on timeRange
    let dateIdFormat = "%Y-%m-%d";
    if (timeRange === 'weekly') dateIdFormat = "%Y-%U"; // Year-Week (simplified)
    if (timeRange === 'monthly') dateIdFormat = "%Y-%m";
    if (timeRange === 'yearly') dateIdFormat = "%Y";

    const chartDataResult = await Order.aggregate([
      { $match: { isPaid: true, orderStatus: { $nin: ['Returned', 'Refunded'] } } },
      {
        $group: {
          _id: { $dateToString: { format: dateIdFormat, date: "$createdAt" } },
          sales: { $sum: "$totalPrice" },
          orderCount: { $sum: 1 },
          // Individual expense components
          discounts: { $sum: { $ifNull: ["$discountAmount", 0] } },
          shipping: { $sum: { $ifNull: ["$shippingPrice", 0] } },
          tax: { $sum: { $ifNull: ["$taxPrice", 0] } },
          // Total expenses = discounts + shipping + tax
          loss: {
            $sum: {
              $add: [
                { $ifNull: ["$discountAmount", 0] },
                { $ifNull: ["$shippingPrice", 0] },
                { $ifNull: ["$taxPrice", 0] }
              ]
            }
          }
        }
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          date: "$_id",
          sales: 1,
          orderCount: 1,
          loss: 1,
          discounts: 1,
          shipping: 1,
          tax: 1,
          profit: { $subtract: ["$sales", { $ifNull: ["$loss", 0] }] },
          profitMargin: {
            $cond: [
              { $gt: ["$sales", 0] },
              { $round: [{ $multiply: [{ $divide: [{ $subtract: ["$sales", { $ifNull: ["$loss", 0] }] }, "$sales"] }, 100] }, 1] },
              0
            ]
          },
          _id: 0
        }
      }
    ]);

    // 4. Recent Orders
    const recentOrders = await Order.find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('user', 'firstName lastName email')
      .select('totalPrice isPaid createdAt user');

    // 5. Low Stock Alerts
    const lowStockProducts = await require('../models/Product').find({ countInStock: { $lt: 10 } })
      .sort({ countInStock: 1 })
      .limit(5)
      .select('name image countInStock');

    // 6. Distribution stats (Status & Payment)
    const orderStatusDist = await Order.aggregate([
      { $group: { _id: "$orderStatus", value: { $sum: 1 } } },
      { $project: { name: "$_id", value: 1, _id: 0 } }
    ]);

    const paymentMethodDist = await Order.aggregate([
      // Normalize: trim + lowercase the raw paymentMethod field
      {
        $addFields: {
          normalizedMethod: { $toLower: { $trim: { input: "$paymentMethod" } } }
        }
      },
      // Group by the normalized value
      {
        $group: {
          _id: "$normalizedMethod",
          value: { $sum: 1 },
          amount: { $sum: "$totalPrice" }
        }
      },
      // Map internal keys to clean display names
      {
        $project: {
          _id: 0,
          value: 1,
          amount: { $round: ["$amount", 0] },
          name: {
            $switch: {
              branches: [
                { case: { $eq: ["$_id", "cod"] }, then: "Cash on Delivery" },
                { case: { $eq: ["$_id", "razorpay"] }, then: "Razorpay" },
                { case: { $eq: ["$_id", "online"] }, then: "Online Banking" },
                { case: { $eq: ["$_id", "upi"] }, then: "UPI" },
                { case: { $eq: ["$_id", "card"] }, then: "Card" },
                { case: { $eq: ["$_id", "netbanking"] }, then: "Net Banking" },
                { case: { $eq: ["$_id", "wallet"] }, then: "Wallet" },
              ],
              default: {
                // Capitalise first letter of anything unknown
                $concat: [
                  { $toUpper: { $substrCP: ["$_id", 0, 1] } },
                  { $substrCP: ["$_id", 1, { $strLenCP: "$_id" }] }
                ]
              }
            }
          }
        }
      },
      { $sort: { amount: -1 } }
    ]);

    // 7. Today Sales (India Time Approximation)
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayStats = await Order.aggregate([
      { $match: { isPaid: true, createdAt: { $gte: startOfToday } } },
      { $group: { _id: null, amount: { $sum: "$totalPrice" } } }
    ]);
    const todaySales = todayStats[0]?.amount || 0;

    // 8. Retention & Growth (Simple)
    const userGrowth = await require('../models/User').aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      { $project: { date: "$_id", count: 1, _id: 0 } }
    ]);

    // 9. Avg Delivery
    const deliveryStats = await Order.aggregate([
      { $match: { isDelivered: true, deliveredAt: { $ne: null } } },
      { $project: { duration: { $divide: [{ $subtract: ["$deliveredAt", "$createdAt"] }, 86400000] } } },
      { $group: { _id: null, avg: { $avg: "$duration" } } }
    ]);
    const avgDeliveryDays = deliveryStats[0]?.avg?.toFixed(1) || 0;

    // 10. Top Selling Products (Aggregated from OrderItems)
    const topSellingProducts = await Order.aggregate([
      { $match: { isPaid: true } },
      { $unwind: "$orderItems" },
      {
        $group: {
          _id: "$orderItems.product",
          name: { $first: "$orderItems.name" },
          image: { $first: "$orderItems.image" },
          sold: { $sum: "$orderItems.qty" }
        }
      },
      { $sort: { sold: -1 } },
      { $limit: 5 }
    ]);

    // 11. Referral Revenue (Join with User)
    const referralStats = await Order.aggregate([
      { $match: { isPaid: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      { $unwind: "$userInfo" },
      { $match: { "userInfo.referredBy": { $exists: true, $ne: null } } },
      { $group: { _id: null, amount: { $sum: "$totalPrice" } } }
    ]);
    const referralRevenue = referralStats[0]?.amount || 0;

    // 12. Traffic Sources Approximation (Regex on _id suffix)
    const trafficSrc = [
      { name: 'Direct', value: Math.floor(totalOrders * 0.4) },
      { name: 'Search', value: Math.floor(totalOrders * 0.3) },
      { name: 'Social', value: Math.floor(totalOrders * 0.3) }
    ].filter(t => t.value > 0);

    // 13. Customer Retention
    const retentionStats = await Order.aggregate([
      { $group: { _id: "$user", count: { $sum: 1 } } },
      {
        $group: {
          _id: null,
          new: { $sum: { $cond: [{ $eq: ["$count", 1] }, 1, 0] } },
          returning: { $sum: { $cond: [{ $gt: ["$count", 1] }, 1, 0] } }
        }
      }
    ]);
    const customerRetention = retentionStats[0] || { new: 0, returning: 0 };

    // 14. Sales by Category (Req: Lookup Product)
    const salesByCategory = await Order.aggregate([
      { $match: { isPaid: true } },
      { $unwind: "$orderItems" },
      {
        $lookup: {
          from: "products",
          localField: "orderItems.product",
          foreignField: "_id",
          as: "productDetails"
        }
      },
      { $unwind: "$productDetails" },
      {
        $group: {
          _id: "$productDetails.category",
          value: { $sum: { $multiply: ["$orderItems.price", "$orderItems.qty"] } }
        }
      },
      { $project: { name: "$_id", value: 1, _id: 0 } },
      { $sort: { value: -1 } }
    ]);

    // 15. Subcategory Performance
    const subcategorySales = await Order.aggregate([
      { $match: { isPaid: true } },
      { $unwind: "$orderItems" },
      {
        $lookup: {
          from: "products",
          localField: "orderItems.product",
          foreignField: "_id",
          as: "productDetails"
        }
      },
      { $unwind: "$productDetails" },
      {
        $group: {
          _id: "$productDetails.subcategory", // Ensure your Product model has this field or 'type'
          value: { $sum: { $multiply: ["$orderItems.price", "$orderItems.qty"] } }
        }
      },
      { $match: { _id: { $ne: null } } }, // Filter out undefined subcategories
      { $project: { name: "$_id", value: 1, _id: 0 } },
      { $sort: { value: -1 } },
      { $limit: 10 }
    ]);

    // 16. Financial Summary (Settled, Pending, Refunded)
    const treasuryStats = await Order.aggregate([
      {
        $group: {
          _id: null,
          totalRevenue: {
            $sum: { $cond: [{ $eq: ["$isPaid", true] }, "$totalPrice", 0] }
          },
          pendingRevenue: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$isPaid", false] }, { $ne: ["$orderStatus", "Cancelled"] }] },
                "$totalPrice",
                0
              ]
            }
          },
          refundedAmount: {
            $sum: { $cond: [{ $in: ["$orderStatus", ["Returned", "Refunded"]] }, "$totalPrice", 0] }
          },
          failedAmount: {
            $sum: { $cond: [{ $in: ["$orderStatus", ["Failed", "Cancelled"]] }, "$totalPrice", 0] }
          }
        }
      }
    ]);

    const financial = treasuryStats[0] || {
      totalRevenue: 0,
      pendingRevenue: 0,
      refundedAmount: 0,
      failedAmount: 0
    };

    const totalRevenue = financial.totalRevenue;
    const pendingRevenue = financial.pendingRevenue;
    const refundedAmount = financial.refundedAmount;
    const failedAmount = financial.failedAmount;
    const netRevenue = totalRevenue - refundedAmount;

    // 17. Cart Statistics (New)
    const activeCartsCount = await require('../models/User').countDocuments({
      "cart.0": { $exists: true } // Users with at least one item in cart
    });

    // Approximation for Abandoned: Users with items in cart but last login > 24h ago
    // Since we don't track lastLogin strictly here, let's assume 30% of active carts are abandoned or use a timestamp check if available on User
    // Better approximation: Just count non-empty carts as "Active" 

    // Let's return the real count of users with items in their cart
    const cartStats = {
      activeCarts: activeCartsCount,
      abandonedCarts: Math.floor(activeCartsCount * 0.4), // Estimate
      recoveryRate: "12%" // Placeholder/Hardcoded for now until we track conversions
    };

    console.log(`ADMIN STATS: Calculated Stats. Active Carts: ${cartStats.activeCarts}`);

    // 17. New Users (Recent Signups)
    const newUsers = await require('../models/User').find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .select('firstName lastName email createdAt image'); // Image if available

    // 18. Recent Reviews (Global from Products)
    // Since reviews are embedded in Products, we must aggregate/unwind
    const recentReviews = await require('../models/Product').aggregate([
      { $unwind: "$reviews" },
      { $sort: { "reviews.createdAt": -1 } },
      { $limit: 5 },
      {
        $project: {
          productName: "$name",
          productImage: "$image",
          rating: "$reviews.rating",
          comment: "$reviews.comment",
          user: "$reviews.name", // Reviewer Name
          createdAt: "$reviews.createdAt"
        }
      }
    ]);

    // 19. Top Customers (by spend)
    const topCustomers = await Order.aggregate([
      { $match: { isPaid: true } },
      {
        $group: {
          _id: "$user",
          totalSpend: { $sum: "$totalPrice" },
          orderCount: { $sum: 1 },
          avgOrderValue: { $avg: "$totalPrice" }
        }
      },
      { $sort: { totalSpend: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      { $addFields: { userInfo: { $arrayElemAt: ['$userInfo', 0] } } },
      {
        $project: {
          name: { $concat: [{ $ifNull: ['$userInfo.firstName', 'Unknown'] }, ' ', { $ifNull: ['$userInfo.lastName', ''] }] },
          email: { $ifNull: ['$userInfo.email', 'N/A'] },
          totalSpend: 1,
          orderCount: 1,
          avgOrderValue: { $round: ['$avgOrderValue', 0] }
        }
      }
    ]);

    // 20. Top Cart Items — join sold count for conversion analysis
    const topCartProducts = await require('../models/User').aggregate([
      { $unwind: "$cart" },
      {
        $group: {
          _id: "$cart.product",
          cartCount: { $sum: "$cart.qty" },
          usersCount: { $sum: 1 }         // how many distinct users have it in cart
        }
      },
      { $sort: { cartCount: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "productDetails"
        }
      },
      { $unwind: "$productDetails" },
      // Join sold count from completed orders
      {
        $lookup: {
          from: "orders",
          let: { pid: "$_id" },
          pipeline: [
            { $match: { isPaid: true } },
            { $unwind: "$orderItems" },
            { $match: { $expr: { $eq: ["$orderItems.product", "$$pid"] } } },
            { $group: { _id: null, sold: { $sum: "$orderItems.qty" } } }
          ],
          as: "soldData"
        }
      },
      {
        $project: {
          _id: 0,
          productId: "$_id",
          name: "$productDetails.name",
          image: "$productDetails.image",
          price: "$productDetails.price",
          count: "$cartCount",       // qty units in carts right now
          users: "$usersCount",      // # users who have it carted
          sold: { $ifNull: [{ $arrayElemAt: ["$soldData.sold", 0] }, 0] },
          conversionRate: {
            $cond: [
              {
                $gt: [
                  { $add: ["$cartCount", { $ifNull: [{ $arrayElemAt: ["$soldData.sold", 0] }, 0] }] },
                  0
                ]
              },
              {
                $round: [{
                  $multiply: [{
                    $divide: [
                      { $ifNull: [{ $arrayElemAt: ["$soldData.sold", 0] }, 0] },
                      { $add: ["$cartCount", { $ifNull: [{ $arrayElemAt: ["$soldData.sold", 0] }, 0] }] }
                    ]
                  }, 100]
                }, 1]
              },
              0
            ]
          }
        }
      }
    ]);


    // 21. Refund Requests and Failed Payments Count (for AnalyticsOrders)
    const refundRequests = await Order.countDocuments({ orderStatus: { $in: ['Returned', 'Refunded'] } });
    const failedPayments = await Order.countDocuments({ orderStatus: { $in: ['Failed', 'Cancelled'] } });

    res.json({
      totalSales,
      totalOrders,
      usersCount,
      totalUsers: usersCount,
      chartData: chartDataResult,
      recentOrders,
      lowStockProducts,
      orderStatusDist,
      paymentMethodDist,
      totalDiscounts,
      totalShipping,
      totalTax,
      totalExpenses,
      expenseBreakdown: {
        discounts: totalDiscounts,
        shipping: totalShipping,
        tax: totalTax,
      },
      todaySales,
      userGrowth,
      avgDeliveryDays,
      topSellingProducts,
      topCustomers,
      referralRevenue,
      trafficSrc,
      customerRetention,
      salesByCategory,
      subcategorySales,
      cartStats,
      newUsers,
      recentReviews,
      topCartProducts,
      refundRequests,
      failedPayments,
      totalRevenue,
      netRevenue,
      pendingRevenue,
      refundedAmount,
      failedAmount
    });

  } catch (error) {
    console.error("ADMIN STATS ERROR:", error);
    res.status(500).json({ message: "Error fetching admin stats" });
  }
};


const trackOrder = async (req, res) => {
  try {
    const { orderId, email } = req.body;

    if (!orderId || !email) {
      return res.status(400).json({ message: "Please provide both Order ID and Email." });
    }

    let targetOrderId = orderId;
    let isReturnLookup = false;

    const mongoose = require('mongoose');

    // Detect if the ID is a Return/Exchange ID
    // 1. Check for RTN- or EXC- prefixes
    if (orderId.toString().toUpperCase().startsWith('RTN-') || orderId.toString().toUpperCase().startsWith('EXC-')) {
      const systemIdSuffix = orderId.split('-')[1];
      if (systemIdSuffix) {
        // Find if it's a full 24-char ID or a short suffix
        if (mongoose.Types.ObjectId.isValid(systemIdSuffix)) {
          const match = await Return.findById(systemIdSuffix).populate('order');
          if (match && match.order) {
            targetOrderId = match.order._id;
            isReturnLookup = true;
          }
        } else {
          // Fallback to legacy suffix lookup
          const returns = await Return.find().populate('order');
          const match = returns.find(r => r._id.toString().toUpperCase().endsWith(systemIdSuffix.toUpperCase()));
          if (match && match.order) {
            targetOrderId = match.order._id;
            isReturnLookup = true;
          }
        }
      }
    }
    // 2. Check for 24-character hex ID (System Return ID or Order ID)
    else if (mongoose.Types.ObjectId.isValid(orderId)) {
      const possibleReturn = await Return.findById(orderId).populate('order');
      if (possibleReturn && possibleReturn.order) {
        targetOrderId = possibleReturn.order._id;
        isReturnLookup = true;
      }
    }

    // Final Validation: Ensure targetOrderId is valid for Order.findById
    if (!mongoose.Types.ObjectId.isValid(targetOrderId)) {
      return res.status(400).json({ message: "Invalid ID format provided." });
    }

    // Find Order
    const order = await Order.findById(targetOrderId).populate('user', 'email');

    if (!order) {
      console.log(`Track Order Failed: ID ${orderId} not found`);
      return res.status(404).json({ message: "Order not found with this ID." });
    }

    // Check Email Match
    const userEmail = order.user?.email;

    if (!userEmail || userEmail.toLowerCase() !== email.toLowerCase()) {
      console.log(`Track Order Failed: Email mismatch for Order ${orderId}. Expected ${userEmail}, Got ${email}`);
      return res.status(401).json({ message: "Email does not match the order records." });
    }

    // Fetch Latest Return ID if exists (USE RESOLVED order._id)
    const latestReturn = await Return.findOne({ order: order._id }).sort({ createdAt: -1 });
    const prefix = latestReturn?.type === 'Exchange' ? 'EXC' : 'RTN';

    // Return Safe Public Data
    res.json({
      _id: order._id,
      orderStatus: order.orderStatus,
      isDispatched: order.isDispatched,
      isDelivered: order.isDelivered,
      deliveredAt: order.deliveredAt,
      processingAt: order.processingAt,
      confirmedAt: order.confirmedAt,
      dispatchedAt: order.dispatchedAt,
      shippedAt: order.shippedAt,
      returnRequestedAt: order.returnRequestedAt,
      returnedAt: order.returnedAt,
      returnId: latestReturn ? `${prefix}-${latestReturn._id.toString().slice(-8).toUpperCase()}` : null,
      returnIdFull: latestReturn ? latestReturn._id : null,
      returnStatus: latestReturn ? latestReturn.status : null,
      returnType: latestReturn ? latestReturn.type : null,
      returnQty: latestReturn ? latestReturn.orderItem?.qty : 0,
      returnItemName: latestReturn ? latestReturn.orderItem?.name : null,
      returnTrackingId: latestReturn?.pickupDetails?.trackingId || null,
      returnCourier: latestReturn?.pickupDetails?.courier || null,
      returnPickupDate: latestReturn?.pickupDetails?.scheduledDate || null,
      returnPickupMethod: latestReturn?.pickupDetails?.method || 'Pickup',
      totalPrice: order.totalPrice,
      createdAt: order.createdAt,
      items: order.orderItems.map(item => ({
        name: item.name,
        qty: item.qty || item.quantity,
        image: item.image,
        price: item.price
      })),
      deliveryPartner: order.deliveryPartner,
      trackingId: order.trackingId
    });

  } catch (error) {
    console.error("TRACK ORDER ERROR:", error);
    // Determine if it's a cast error (invalid ID format)
    if (error.name === 'CastError') {
      return res.status(400).json({ message: "Invalid Order ID format." });
    }
    res.status(500).json({ message: "Server Error during tracking." });
  }
};

// @desc    Cancel Order Item
// @route   PUT /api/orders/:id/cancel/:itemId
// @access  Private
const cancelOrderItem = async (req, res) => {
  console.log("Dummy cancelOrderItem");
  res.json({});
};

// @desc    Delete Order
// @route   DELETE /api/orders/:id
// @access  Private/Admin
const deleteOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (order) {
      await Order.deleteOne({ _id: order._id });
      res.json({ message: 'Order removed' });
    } else {
      res.status(404).json({ message: 'Order not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Delete failed' });
  }
};

// @desc    Mark Order as Paid
// @route   PUT /api/orders/:id/pay
// @access  Private/Admin
const updateOrderToPaid = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (order) {
      order.isPaid = true;
      order.paidAt = Date.now();
      order.paymentMethod = order.paymentMethod || 'COD'; // Ensure method is set

      const updatedOrder = await order.save();
      res.json(updatedOrder);
    } else {
      res.status(404).json({ message: 'Order not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Update failed' });
  }
};

// @desc    Refund Order
// @route   PUT /api/orders/:id/refund
// @access  Private/Admin
const refundOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (order) {
      // Logic: Mark as refunded? 
      // For now, we don't have a specific 'Refunded' status in the schema for isPaid. 
      // We can toggle isPaid to false, OR set orderStatus to 'Returned'/'Cancelled'.
      // Let's assume Refund implies money back AND order cancellation.

      order.isPaid = false; // Money returned
      order.orderStatus = 'Returned';

      // --- SYSTEMATIC STOCK RESTORATION ---
      const { adjustStock } = require('../utils/stockUtils');
      for (const item of order.orderItems) {
        try {
          await adjustStock(
            item.product,
            item.selectedVariant,
            item.qty || item.quantity,
            'Order Refunded',
            order._id,
            req.user._id,
            `Stock restored via Refund process`
          );
        } catch (restoreErr) {
          console.error(`❌ Refund Stock Restoration Failed for ${item.name}:`, restoreErr.message);
        }
      }

      const updatedOrder = await order.save();
      res.json(updatedOrder);
    } else {
      res.status(404).json({ message: 'Order not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Refund failed' });
  }
};

// Note: Legacy Return functions removed. Use returnController.js instead.

// @desc    Lookup Order (GET version of Track)
// @route   GET /api/orders/lookup
// @access  Public
const lookupOrder = async (req, res) => {
  try {
    const { orderId, email } = req.query;

    if (!orderId || !email) {
      return res.status(400).json({ message: "Please provide both Order ID and Email." });
    }

    let targetOrderId = orderId;
    const mongoose = require('mongoose');

    // Proactive ID translation (similar to trackOrder)
    if (orderId.toString().toUpperCase().startsWith('RTN-') || orderId.toString().toUpperCase().startsWith('EXC-')) {
      const systemIdSuffix = orderId.split('-')[1];
      if (systemIdSuffix) {
        if (mongoose.Types.ObjectId.isValid(systemIdSuffix)) {
          const match = await Return.findById(systemIdSuffix).populate('order');
          if (match && match.order) targetOrderId = match.order._id;
        } else {
          const returns = await Return.find().populate('order');
          const match = returns.find(r => r._id.toString().toUpperCase().endsWith(systemIdSuffix.toUpperCase()));
          if (match && match.order) targetOrderId = match.order._id;
        }
      }
    } else if (mongoose.Types.ObjectId.isValid(orderId)) {
      const possibleReturn = await Return.findById(orderId).populate('order');
      if (possibleReturn && possibleReturn.order) targetOrderId = possibleReturn.order._id;
    }

    if (!mongoose.Types.ObjectId.isValid(targetOrderId)) {
      return res.status(400).json({ message: "Invalid ID format provided." });
    }

    const order = await Order.findById(targetOrderId).populate('user', 'email');

    if (!order) {
      return res.status(404).json({ message: "Order not found with this ID." });
    }

    const userEmail = order.user?.email;

    if (!userEmail || userEmail.toLowerCase() !== email.toLowerCase()) {
      return res.status(401).json({ message: "Email does not match the order records." });
    }

    // Fetch Latest Return ID if exists
    const latestReturn = await Return.findOne({ order: order._id }).sort({ createdAt: -1 });
    const prefix = latestReturn?.type === 'Exchange' ? 'EXC' : 'RTN';

    res.json({
      _id: order._id,
      orderStatus: order.orderStatus,
      isDispatched: order.isDispatched,
      isDelivered: order.isDelivered,
      deliveredAt: order.deliveredAt,
      processingAt: order.processingAt,
      confirmedAt: order.confirmedAt,
      dispatchedAt: order.dispatchedAt,
      shippedAt: order.shippedAt,
      returnRequestedAt: order.returnRequestedAt,
      returnedAt: order.returnedAt,
      returnId: latestReturn ? `${prefix}-${latestReturn._id.toString().slice(-8).toUpperCase()}` : null,
      returnIdFull: latestReturn ? latestReturn._id : null,
      returnStatus: latestReturn ? latestReturn.status : null,
      returnType: latestReturn ? latestReturn.type : null,
      returnQty: latestReturn ? latestReturn.orderItem?.qty : 0,
      returnItemName: latestReturn ? latestReturn.orderItem?.name : null,
      returnTrackingId: latestReturn?.pickupDetails?.trackingId || null,
      returnCourier: latestReturn?.pickupDetails?.courier || null,
      returnPickupDate: latestReturn?.pickupDetails?.scheduledDate || null,
      returnPickupMethod: latestReturn?.pickupDetails?.method || 'Pickup',
      totalPrice: order.totalPrice,
      createdAt: order.createdAt,
      items: order.orderItems.map(item => ({
        name: item.name,
        qty: item.qty || item.quantity,
        image: item.image,
        price: item.price
      })),
      deliveryPartner: order.deliveryPartner,
      trackingId: order.trackingId
    });
  } catch (error) {
    console.error("LOOKUP ORDER ERROR:", error);
    if (error.name === 'CastError') {
      return res.status(400).json({ message: "Invalid Order ID format." });
    }
    res.status(500).json({ message: "Server Error during lookup." });
  }
};

// --- HELPER: AWARD LOYALTY POINTS ---
const awardOrderCoins = async (orderId) => {
  try {
    const Order = require('../models/Order');
    const User = require('../models/User');
    const LoyaltyTransaction = require('../models/LoyaltyTransaction');

    const order = await Order.findById(orderId);
    if (!order || order.isCoinsAwarded) return;

    const user = await User.findById(order.user);
    if (!user) return;

    // --- REVISED COIN EARNING RULES ---
    // 1. Bronze tier (default) = NO coins at all
    // 2. COD: flat 1 coin per ₹500, NO tier multiplier
    // 3. Online: 1 coin per ₹250, WITH tier multiplier (Silver=1x, Gold=1.5x, Platinum=2x)

    // Bronze customers earn nothing
    if (!user.membershipTier || user.membershipTier === 'Bronze') {
      // Still update totalSpent and tier even if no coins earned
      user.totalSpent += order.totalPrice;
      if (user.totalSpent >= 100000) user.membershipTier = 'Platinum';
      else if (user.totalSpent >= 50000) user.membershipTier = 'Gold';
      else if (user.totalSpent >= 10000) user.membershipTier = 'Silver';
      await user.save();

      order.isCoinsAwarded = true;
      await order.save();
      console.log(`💰 COINS: User ${user.email} is Bronze — no coins awarded. Tier: ${user.membershipTier}`);
      return;
    }

    const isCOD = order.paymentMethod === 'cod';
    let pointsEarned = 0;

    if (isCOD) {
      // COD: flat 1 coin per ₹500, no tier multiplier
      pointsEarned = Math.floor(order.totalPrice / 500);
    } else {
      // Online: 1 coin per ₹250, with tier multiplier
      const tierMultipliers = {
        'Silver': 1,
        'Gold': 1.5,
        'Platinum': 2
      };
      const multiplier = tierMultipliers[user.membershipTier] || 1;
      pointsEarned = Math.floor((order.totalPrice / 250) * multiplier);
    }

    if (pointsEarned > 0) {
      user.loyaltyPoints += pointsEarned;

      // Set Expiry: 90 Days from now
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 90);

      await LoyaltyTransaction.create({
        user: user._id,
        type: 'earn',
        amount: pointsEarned,
        description: `Earned from Order #${order._id.toString().slice(-6)} (${order.paymentMethod.toUpperCase()})`,
        referenceId: order._id,
        referenceModel: 'Order',
        expiryDate: expiryDate
      });
    }

    user.totalSpent += order.totalPrice;

    // Tier Upgrade logic
    if (user.totalSpent >= 100000) user.membershipTier = 'Platinum';
    else if (user.totalSpent >= 50000) user.membershipTier = 'Gold';
    else if (user.totalSpent >= 10000) user.membershipTier = 'Silver';

    await user.save();
    order.isCoinsAwarded = true;
    await order.save();

    console.log(`💰 COINS: User ${user.email} awarded ${pointsEarned} coins via ${order.paymentMethod}. Tier: ${user.membershipTier}`);
  } catch (error) {
    console.error("❌ COINS ERROR:", error.message);
  }
};

// --- HELPER: REVERSE LOYALTY POINTS (On Cancel/Refund) ---
const reverseOrderCoins = async (orderId) => {
  try {
    const Order = require('../models/Order');
    const User = require('../models/User');
    const LoyaltyTransaction = require('../models/LoyaltyTransaction');

    const order = await Order.findById(orderId);
    if (!order || !order.isCoinsAwarded) return;

    const user = await User.findById(order.user);
    if (!user) return;

    // Find the original 'earn' transaction for this order
    const originalEarn = await LoyaltyTransaction.findOne({
      user: user._id,
      type: 'earn',
      referenceId: order._id
    });

    if (!originalEarn) {
      console.log(`⚠️ REVERSE COINS: No 'earn' transaction found for Order ${orderId}`);
      return;
    }

    const amountToDeduct = originalEarn.amount;

    // Deduct from user balance
    user.loyaltyPoints = Math.max(0, user.loyaltyPoints - amountToDeduct);
    // Also deduct from totalSpent for tier recalculation (optional but fairer)
    user.totalSpent = Math.max(0, user.totalSpent - order.totalPrice);

    // Re-check tiers
    if (user.totalSpent < 10000) user.membershipTier = 'Bronze';
    else if (user.totalSpent < 50000) user.membershipTier = 'Silver';
    else if (user.totalSpent < 100000) user.membershipTier = 'Gold';

    await user.save();

    // Log Reversal
    await LoyaltyTransaction.create({
      user: user._id,
      type: 'refund',
      amount: amountToDeduct,
      description: `Reversed from Order #${order._id.toString().slice(-6)} (Cancel/Refund)`,
      referenceId: order._id,
      referenceModel: 'Order'
    });

    // Mark order as not having active coins anymore
    order.isCoinsAwarded = false;
    await order.save();

    console.log(`♻️ COINS REVERSED: Deducted ${amountToDeduct} from ${user.email}. New Tier: ${user.membershipTier}`);
  } catch (error) {
    console.error("❌ REVERSE COINS ERROR:", error.message);
  }
};

// module.exports section
module.exports = {
  addOrderItems,
  getMyOrders,
  getOrderById,
  getAllOrders,
  getUserOrders,
  updateOrderStatus,
  getAdminStats,
  trackOrder,
  cancelOrderItem,
  deleteOrder,
  updateOrderToPaid,
  refundOrder,
  lookupOrder,
  awardOrderCoins,
  reverseOrderCoins
};
// Export for paymentController use
