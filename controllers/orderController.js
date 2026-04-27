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
  const { orderItems, shippingAddress, paymentMethod, totalPrice, taxPrice, shippingPrice } = req.body;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!orderItems || orderItems.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'No order items provided' });
    }

    const Coupon = require('../models/Coupon');
    const User = require('../models/User');
    const SiteSettings = require('../models/SiteSettings');
    const settings = await SiteSettings.getSettings();

    // 1. Validate & Adjust Prices (Coupon/Loyalty)
    let finalTotalPrice = totalPrice;
    let discountAmount = 0;

    if (req.body.couponCode) {
      const coupon = await Coupon.findOne({ code: req.body.couponCode.toUpperCase() }).session(session);
      if (coupon && coupon.isActive && new Date(coupon.expiryDate) > Date.now()) {
        if (!coupon.usageLimit || coupon.usedCount < coupon.usageLimit) {
           if (totalPrice >= coupon.minPurchase) {
             discountAmount = coupon.discountType === 'percentage' ? (totalPrice * coupon.discountAmount) / 100 : coupon.discountAmount;
             finalTotalPrice = Math.max(0, totalPrice - discountAmount);
             coupon.usedCount += 1;
             await coupon.save({ session });
           }
        }
      }
    }

    // 2. Stock Check & Deduct (ATOMIC)
    const { adjustStock } = require('../utils/stockUtils');
    for (const item of orderItems) {
      const productId = item.product?._id || item.product;
      await adjustStock(
        productId,
        item.selectedVariant,
        -(item.qty || item.quantity),
        'Order',
        'Pending',
        null,
        `Order Placement`,
        { session } // Pass session to utility
      );
    }

    // 3. Create Order
    const order = new Order({
      user: req.user._id,
      orderItems: orderItems.map(item => ({
        ...item,
        product: item.product?._id || item.product
      })),
      shippingAddress,
      paymentMethod,
      totalPrice: finalTotalPrice,
      discountAmount,
      taxPrice,
      shippingPrice,
      isPaid: paymentMethod !== 'cod'
    });

    const createdOrder = await order.save({ session });

    // 4. Finalize
    await session.commitTransaction();
    
    // Background tasks (Non-critical)
    emailQueue.add('order-confirmation', {
      type: 'order-confirmation',
      data: { email: req.user.email, orderId: createdOrder._id }
    }).catch(() => {});

    res.status(201).json({ order: createdOrder });

  } catch (error) {
    await session.abortTransaction();
    console.error("TRANSACTION ABORTED:", error.message);
    res.status(400).json({ message: error.message || "Order failed" });
  } finally {
    session.endSession();
  }
};

const getMyOrders = async (req, res) => {
  try {
    // 1. Fetch raw orders
    const myOrdersRaw = await Order.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .select('_id orderStatus isPaid paidAt isDispatched dispatchedAt shippedAt isDelivered deliveredAt processingAt confirmedAt returnStatus returnRequestedAt returnedAt totalPrice createdAt orderItems');

    if (myOrdersRaw.length === 0) return res.status(200).json([]);

    // 2. Optimized: Fetch all returns for these orders in one query (Avoid N+1)
    const orderIds = myOrdersRaw.map(o => o._id);
    const returns = await Return.find({ order: { $in: orderIds } }).lean();

    // Map returns for quick lookup
    const returnMap = {};
    returns.forEach(r => {
      // Map to the most recent return per order
      const orderIdStr = r.order.toString();
      if (!returnMap[orderIdStr] || new Date(r.createdAt) > new Date(returnMap[orderIdStr].createdAt)) {
        returnMap[orderIdStr] = r;
      }
    });

    // 3. Assemble final data
    const myOrders = myOrdersRaw.map((order) => {
      const latestReturn = returnMap[order._id.toString()];
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
    });

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
        req.user && (
          req.user.role === 'admin' ||
          req.user.role === 'manager' ||
          req.user.permissions?.includes('manage_orders') ||
          (order.user && order.user.toString() === req.user._id.toString())
        );

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
        const SiteSettings = require('../models/SiteSettings');
        const settings = await SiteSettings.getSettings();

        if (settings.isReferralEnabled && user && user.referredBy && !user.hasMadeFirstOrder) {
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

      // --- REVERSE COINS IF CANCELLED/RETURNED/REFUNDED ---
      if (['Cancelled', 'Returned', 'Refunded'].includes(status)) {
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
    const { forceRefresh = false } = req.query;
    const cacheKey = 'admin_stats_global';

    if (!forceRefresh) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return res.json(JSON.parse(cached));
      }
    }

    // Use Promise.all to run all independent aggregations and counts in parallel
    const [
      usersCount,
      productsCount,
      financialStats,
      chartDataResult,
      recentOrders,
      lowStockProducts,
      orderStatusDist,
      paymentMethodDist,
      todayStats,
      userGrowth,
      deliveryStats,
      topSellingProducts,
      referralStats,
      retentionStats,
      salesByCategory,
      subcategorySales,
      treasuryStats,
      activeCartsCount,
      newUsers,
      recentReviews,
      topCustomers,
      topCartProducts,
      refundRequests,
      failedPayments
    ] = await Promise.all([
      // 1. Basic Counts
      require('../models/User').countDocuments(),
      require('../models/Product').countDocuments(),

      // 2. Financial Totals (Paid Only)
      Order.aggregate([
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
      ]),

      // 3. Sales Chart Data (Last 12 Months)
      Order.aggregate([
        { $match: { isPaid: true, createdAt: { $gte: new Date(new Date().setFullYear(new Date().getFullYear() - 1)) } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, sales: { $sum: "$totalPrice" }, orders: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        { $project: { month: "$_id", sales: 1, orders: 1, _id: 0 } }
      ]),

      // 4. Recent Activity
      Order.find({}).sort({ createdAt: -1 }).limit(8).populate('user', 'firstName lastName email'),

      // 5. Low Stock Alerts
      require('../models/Product').find({ countInStock: { $lt: 10 } })
        .sort({ countInStock: 1 })
        .limit(5)
        .select('name image countInStock'),

      // 6a. Order Status Dist
      Order.aggregate([
        { $group: { _id: "$orderStatus", value: { $sum: 1 } } },
        { $project: { name: "$_id", value: 1, _id: 0 } }
      ]),

      // 6b. Payment Method Dist
      Order.aggregate([
        { $addFields: { normalizedMethod: { $toLower: { $trim: { input: "$paymentMethod" } } } } },
        { $group: { _id: "$normalizedMethod", value: { $sum: 1 }, amount: { $sum: "$totalPrice" } } },
        {
          $project: {
            _id: 0, value: 1, amount: { $round: ["$amount", 0] },
            name: {
              $switch: {
                branches: [
                  { case: { $eq: ["$_id", "cod"] }, then: "Cash on Delivery" },
                  { case: { $eq: ["$_id", "razorpay"] }, then: "Razorpay" },
                  { case: { $eq: ["$_id", "online"] }, then: "Online Banking" },
                  { case: { $eq: ["$_id", "upi"] }, then: "UPI" },
                  { case: { $eq: ["$_id", "card"] }, then: "Card" },
                ],
                default: "$_id"
              }
            }
          }
        }
      ]),

      // 7. Today Sales
      Order.aggregate([
        { $match: { isPaid: true, createdAt: { $gte: new Date(new Date().setHours(0,0,0,0)) } } },
        { $group: { _id: null, amount: { $sum: "$totalPrice" } } }
      ]),

      // 8. User Growth
      require('../models/User').aggregate([
        { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        { $project: { date: "$_id", count: 1, _id: 0 } }
      ]),

      // 9. Delivery Stats
      Order.aggregate([
        { $match: { isDelivered: true, deliveredAt: { $ne: null } } },
        { $project: { duration: { $divide: [{ $subtract: ["$deliveredAt", "$createdAt"] }, 86400000] } } },
        { $group: { _id: null, avg: { $avg: "$duration" } } }
      ]),

      // 10. Top Selling
      Order.aggregate([
        { $match: { isPaid: true } },
        { $unwind: "$orderItems" },
        { $group: { _id: "$orderItems.product", name: { $first: "$orderItems.name" }, image: { $first: "$orderItems.image" }, sold: { $sum: "$orderItems.qty" } } },
        { $sort: { sold: -1 } },
        { $limit: 5 }
      ]),

      // 11. Referral Revenue
      Order.aggregate([
        { $match: { isPaid: true } },
        { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'userInfo' } },
        { $unwind: "$userInfo" },
        { $match: { "userInfo.referredBy": { $exists: true, $ne: null } } },
        { $group: { _id: null, amount: { $sum: "$totalPrice" } } }
      ]),

      // 13. Retention
      Order.aggregate([
        { $group: { _id: "$user", count: { $sum: 1 } } },
        { $group: { _id: null, new: { $sum: { $cond: [{ $eq: ["$count", 1] }, 1, 0] } }, returning: { $sum: { $cond: [{ $gt: ["$count", 1] }, 1, 0] } } } }
      ]),

      // 14. Sales by Category
      Order.aggregate([
        { $match: { isPaid: true } },
        { $unwind: "$orderItems" },
        { $lookup: { from: "products", localField: "orderItems.product", foreignField: "_id", as: "pd" } },
        { $unwind: "$pd" },
        { $group: { _id: "$pd.category", value: { $sum: { $multiply: ["$orderItems.price", "$orderItems.qty"] } } } },
        { $project: { name: "$_id", value: 1, _id: 0 } },
        { $sort: { value: -1 } }
      ]),

      // 15. Subcategory Sales
      Order.aggregate([
        { $match: { isPaid: true } },
        { $unwind: "$orderItems" },
        { $lookup: { from: "products", localField: "orderItems.product", foreignField: "_id", as: "pd" } },
        { $unwind: "$pd" },
        { $group: { _id: "$pd.subcategory", value: { $sum: { $multiply: ["$orderItems.price", "$orderItems.qty"] } } } },
        { $match: { _id: { $ne: null } } },
        { $project: { name: "$_id", value: 1, _id: 0 } },
        { $sort: { value: -1 } },
        { $limit: 10 }
      ]),

      // 16. Treasury Stats
      Order.aggregate([
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: { $cond: [{ $eq: ["$isPaid", true] }, "$totalPrice", 0] } },
            pendingRevenue: { $sum: { $cond: [{ $and: [{ $eq: ["$isPaid", false] }, { $ne: ["$orderStatus", "Cancelled"] }] }, "$totalPrice", 0] } },
            refundedAmount: { $sum: { $cond: [{ $in: ["$orderStatus", ["Returned", "Refunded"]] }, "$totalPrice", 0] } },
            failedAmount: { $sum: { $cond: [{ $in: ["$orderStatus", ["Failed", "Cancelled"]] }, "$totalPrice", 0] } }
          }
        }
      ]),

      // 17. Active Carts Count
      require('../models/User').countDocuments({ "cart.0": { $exists: true } }),

      // 18. New Users
      require('../models/User').find({}).sort({ createdAt: -1 }).limit(5).select('firstName lastName email createdAt image'),

      // 19. Recent Reviews
      require('../models/Product').aggregate([
        { $unwind: "$reviews" }, { $sort: { "reviews.createdAt": -1 } }, { $limit: 5 },
        { $project: { productName: "$name", productImage: "$image", rating: "$reviews.rating", comment: "$reviews.comment", user: "$reviews.name", createdAt: "$reviews.createdAt" } }
      ]),

      // 20. Top Customers
      Order.aggregate([
        { $match: { isPaid: true } },
        { $group: { _id: "$user", totalSpend: { $sum: "$totalPrice" }, orderCount: { $sum: 1 }, avgOrderValue: { $avg: "$totalPrice" } } },
        { $sort: { totalSpend: -1 } }, { $limit: 10 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'userInfo' } },
        { $unwind: "$userInfo" },
        { $project: { name: { $concat: [{ $ifNull: ['$userInfo.firstName', 'Unknown'] }, ' ', { $ifNull: ['$userInfo.lastName', ''] }] }, email: { $ifNull: ['$userInfo.email', 'N/A'] }, totalSpend: 1, orderCount: 1, avgOrderValue: { $round: ['$avgOrderValue', 0] } } }
      ]),

      // 21. Top Cart Products
      require('../models/User').aggregate([
        { $unwind: "$cart" },
        { $group: { _id: "$cart.product", cartCount: { $sum: "$cart.qty" }, usersCount: { $sum: 1 } } },
        { $sort: { cartCount: -1 } }, { $limit: 10 },
        { $lookup: { from: "products", localField: "_id", foreignField: "_id", as: "pd" } },
        { $unwind: "$pd" },
        { $project: { name: "$pd.name", image: "$pd.image", price: "$pd.price", count: "$cartCount", users: "$usersCount" } }
      ]),

      // 22. Refund/Failed Counts
      Order.countDocuments({ orderStatus: { $in: ['Returned', 'Refunded'] } }),
      Order.countDocuments({ orderStatus: { $in: ['Failed', 'Cancelled'] } })
    ]);

    const { totalSales = 0, totalOrders = 0 } = financialStats[0] || {};
    const todaySales = todayStats[0]?.amount || 0;
    const avgDeliveryDays = deliveryStats[0]?.avg?.toFixed(1) || 0;
    const referralRevenue = referralStats[0]?.amount || 0;
    const customerRetention = retentionStats[0] || { new: 0, returning: 0 };
    const treasury = treasuryStats[0] || { totalRevenue: 0, pendingRevenue: 0, refundedAmount: 0, failedAmount: 0 };

    const statsResponse = {
      totalSales,
      totalOrders,
      todaySales,
      avgDeliveryDays,
      usersCount,
      productsCount,
      chartData: chartDataResult,
      recentOrders,
      lowStockProducts,
      orderStatusDist,
      paymentMethodDist,
      userGrowth,
      topSellingProducts,
      referralRevenue,
      customerRetention,
      salesByCategory,
      subcategorySales,
      cartStats: {
        activeCarts: activeCartsCount,
        abandonedCarts: Math.floor(activeCartsCount * 0.4),
        recoveryRate: "12%"
      },
      newUsers,
      recentReviews,
      topCustomers,
      topCartProducts,
      refundRequests,
      failedPayments,
      totalRevenue: treasury.totalRevenue,
      netRevenue: treasury.totalRevenue - treasury.refundedAmount,
      pendingRevenue: treasury.pendingRevenue,
      refundedAmount: treasury.refundedAmount,
      failedAmount: treasury.failedAmount,
      trafficSources: [
        { name: 'Direct', value: Math.floor(totalOrders * 0.4) },
        { name: 'Search', value: Math.floor(totalOrders * 0.3) },
        { name: 'Social', value: Math.floor(totalOrders * 0.3) }
      ]
    };

    // Cache result for 5 minutes
    await redis.set(cacheKey, JSON.stringify(statsResponse), 'EX', 300);

    res.json(statsResponse);
  } catch (error) {
    console.error("Admin Stats Error:", error);
    res.status(500).json({ message: "Failed to fetch stats" });
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
        if (mongoose.Types.ObjectId.isValid(systemIdSuffix)) {
          const match = await Return.findById(systemIdSuffix).populate('order');
          if (match && match.order) {
            targetOrderId = match.order._id;
            isReturnLookup = true;
          }
        } else {
          // Optimized suffix lookup via aggregation
          const matches = await Return.aggregate([
            { $addFields: { idStr: { $toString: "$_id" } } },
            { $match: { idStr: { $regex: systemIdSuffix + "$", $options: "i" } } },
            { $limit: 1 }
          ]);
          
          if (matches.length > 0) {
            const fullReturn = await Return.findById(matches[0]._id).populate('order');
            if (fullReturn && fullReturn.order) {
              targetOrderId = fullReturn.order._id;
              isReturnLookup = true;
            }
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
    // 3. Check for short ID (e.g. last 8 chars) without prefix
    else if (orderId.length >= 6 && orderId.length <= 12) {
       const orderMatches = await Order.aggregate([
         { $addFields: { idStr: { $toString: "$_id" } } },
         { $match: { idStr: { $regex: orderId + "$", $options: "i" } } },
         { $limit: 1 }
       ]);
       if (orderMatches.length > 0) {
         targetOrderId = orderMatches[0]._id;
       }
    }

    // Final Validation: If we still don't have a valid ObjectId, it's definitely not found
    if (!mongoose.Types.ObjectId.isValid(targetOrderId)) {
      return res.status(404).json({ message: "No order found with that ID format. Please check your input." });
    }

    // Find Order
    const order = await Order.findById(targetOrderId).populate('user', 'email');

    if (!order) {
      return res.status(404).json({ message: "Order not found. Please verify the ID and Email." });
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

    const SiteSettings = require('../models/SiteSettings');
    const settings = await SiteSettings.getSettings();

    if (!settings.loyaltyPointsEnabled) return;

    // --- DYNAMIC COIN EARNING RULES ---
    // Bronze customers earn nothing
    if (!user.membershipTier || user.membershipTier === 'Bronze') {
      user.totalSpent += order.totalPrice;
      
      // Dynamic Tier Thresholds
      if (user.totalSpent >= (settings.platinumThreshold || 100000)) user.membershipTier = 'Platinum';
      else if (user.totalSpent >= (settings.goldThreshold || 50000)) user.membershipTier = 'Gold';
      else if (user.totalSpent >= (settings.silverThreshold || 10000)) user.membershipTier = 'Silver';
      
      await user.save();
      order.isCoinsAwarded = true;
      await order.save();
      return;
    }

    const isCOD = order.paymentMethod === 'cod';
    let pointsEarned = 0;

    if (isCOD) {
      // COD Earning Rate (Configurable)
      const earnRate = settings.earnRateCOD || 2; // Default 2 coins per 1000 (1 per 500)
      pointsEarned = Math.floor((order.totalPrice / 1000) * earnRate);
    } else {
      // Online Earning Rate (Configurable)
      const earnRate = settings.earnRateOnline || 4; // Default 4 coins per 1000 (1 per 250)
      const tierMultipliers = {
        'Silver': settings.silverMultiplier || 1,
        'Gold': settings.goldMultiplier || 1.5,
        'Platinum': settings.platinumMultiplier || 2
      };
      const multiplier = tierMultipliers[user.membershipTier] || 1;
      pointsEarned = Math.floor(((order.totalPrice / 1000) * earnRate) * multiplier);
    }

    if (pointsEarned > 0) {
      user.loyaltyPoints += pointsEarned;
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

    // Dynamic Tier Thresholds
    if (user.totalSpent >= (settings.platinumThreshold || 100000)) user.membershipTier = 'Platinum';
    else if (user.totalSpent >= (settings.goldThreshold || 50000)) user.membershipTier = 'Gold';
    else if (user.totalSpent >= (settings.silverThreshold || 10000)) user.membershipTier = 'Silver';

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
    const SiteSettings = require('../models/SiteSettings');
    const settings = await SiteSettings.getSettings();

    const order = await Order.findById(orderId);
    if (!order) return;

    const user = await User.findById(order.user);
    if (!user) return;

    // 1. REVERSE EARNED COINS (Deduct from user)
    if (order.isCoinsAwarded) {
      const originalEarn = await LoyaltyTransaction.findOne({
        user: user._id,
        type: 'earn',
        referenceId: order._id
      });

      if (originalEarn) {
        const amountToDeduct = originalEarn.amount;
        user.loyaltyPoints = Math.max(0, user.loyaltyPoints - amountToDeduct);
        
        // Log Reversal
        await LoyaltyTransaction.create({
          user: user._id,
          type: 'refund',
          amount: amountToDeduct,
          description: `Reversed earned coins from Order #${order._id.toString().slice(-6)} (Cancel/Refund)`,
          referenceId: order._id,
          referenceModel: 'Order'
        });
        console.log(`♻️ EARNED COINS REVERSED: Deducted ${amountToDeduct} from ${user.email}`);
      }
      order.isCoinsAwarded = false;
    }

    // 2. REFUND SPENT COINS (Add back to user)
    const originalSpend = await LoyaltyTransaction.findOne({
      user: user._id,
      type: 'spend',
      referenceId: order._id
    });

    if (originalSpend) {
      const amountToRefund = originalSpend.amount;
      user.loyaltyPoints += amountToRefund;

      // Log Refund
      await LoyaltyTransaction.create({
        user: user._id,
        type: 'bonus',
        amount: amountToRefund,
        description: `Refunded spent coins from Order #${order._id.toString().slice(-6)} (Cancel/Refund)`,
        referenceId: order._id,
        referenceModel: 'Order'
      });
      console.log(`💰 SPENT COINS REFUNDED: Added ${amountToRefund} back to ${user.email}`);
    }

    // 3. RE-CALCULATE TOTAL SPENT & TIER
    if (order.isPaid || order.orderStatus === 'Delivered') {
      user.totalSpent = Math.max(0, user.totalSpent - order.totalPrice);
    }
    if (user.totalSpent >= (settings.platinumThreshold || 100000)) user.membershipTier = 'Platinum';
    else if (user.totalSpent >= (settings.goldThreshold || 50000)) user.membershipTier = 'Gold';
    else if (user.totalSpent >= (settings.silverThreshold || 10000)) user.membershipTier = 'Silver';
    else user.membershipTier = 'Bronze';

    await user.save();
    await order.save();

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
