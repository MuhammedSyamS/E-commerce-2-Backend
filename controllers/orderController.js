const Order = require('../models/Order');

exports.addOrderItems = async (req, res) => {
  try {
    const { orderItems, shippingAddress, paymentMethod, totalPrice } = req.body;

    if (!orderItems || orderItems.length === 0) {
      return res.status(400).json({ message: 'No order items provided' });
    }

    // CHECK STOCK & DECREMENT
    // We need to do this serially to avoid race conditions (in a real app, use transactions)
    const productUpdates = [];

    for (const item of orderItems) {
      const product = await require('../models/Product').findById(item.product?._id || item.product);
      if (!product) {
        return res.status(404).json({ message: `Product not found: ${item.name}` });
      }
      if (product.countInStock < (item.qty || item.quantity)) {
        return res.status(400).json({ message: `Out of Stock: ${product.name}` });
      }
      product.countInStock -= (item.qty || item.quantity);
      productUpdates.push(product.save());
    }

    await Promise.all(productUpdates);

    // MAP FIELDS EXPLICITLY TO MATCH YOUR SCHEMA
    const order = new Order({
      user: req.user._id,
      orderItems: orderItems.map(item => ({
        name: item.name,
        qty: item.qty || item.quantity,
        image: item.image,
        price: item.price,
        // SAFETY FIX: Ensure we extract the ID string whether it's an object or string
        product: item.product?._id || item.product
      })),
      shippingAddress: {
        address: shippingAddress.address,
        city: shippingAddress.city,
        postalCode: shippingAddress.postalCode || shippingAddress.zip, // Fix: support both names
        phone: shippingAddress.phone
      },
      paymentMethod,
      totalPrice,
      isPaid: paymentMethod === 'cod' ? false : true,
      paidAt: paymentMethod === 'cod' ? null : Date.now(),
    });

    const createdOrder = await order.save();
    res.status(201).json(createdOrder);
  } catch (error) {
    console.error("ORDER ERROR:", error.message); // Look at your terminal!
    res.status(500).json({ message: "Database rejected the order", error: error.message });
  }
};

exports.getMyOrders = async (req, res) => {
  try {
    // Ensure we are searching by the authenticated user's ID
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ message: "Error fetching orders", error: error.message });
  }
};

// --- 3. GET ORDER BY ID ---
exports.getOrderById = async (req, res) => {
  try {
    // Find the order by ID and populate product details (slug is critical for navigation)
    const order = await Order.findById(req.params.id).populate({
      path: 'orderItems.product',
      select: 'slug name image'
    });

    // Security Check: Only the user who placed the order (or an admin) can see it
    if (order) {
      if (order.user.toString() !== req.user._id.toString()) {
        return res.status(401).json({ message: "Not authorized to view this order" });
      }
      res.status(200).json(order);
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
exports.getAllOrders = async (req, res) => {
  try {
    console.log("ADMIN ORDERS: Fetching all orders...");
    const orders = await Order.find({})
      .populate('user', 'id firstName lastName email')
      .sort({ createdAt: -1 });

    console.log(`ADMIN ORDERS: Found ${orders.length} orders.`);
    res.json(orders);
  } catch (error) {
    console.error("ADMIN ORDERS ERROR:", error);
    res.status(500).json({ message: "Error fetching all orders" });
  }
};

// @desc    Get Orders by User ID (Admin)
// @route   GET /api/orders/user/:id
// @access  Private/Admin
exports.getUserOrders = async (req, res) => {
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
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.id);

    if (order) {
      order.orderStatus = status;

      // Sync Booleans for backward compatibility
      if (status === 'Shipped') {
        order.isDispatched = true;
        order.dispatchedAt = Date.now();
        // Update Tracking Info if provided
        if (req.body.deliveryPartner) order.deliveryPartner = req.body.deliveryPartner;
        if (req.body.trackingId) order.trackingId = req.body.trackingId;
      }
      if (status === 'Delivered') {
        order.isDelivered = true;
        order.deliveredAt = Date.now();
      }

      const updatedOrder = await order.save();
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
// @desc    Get Admin Stats (Analytics)
// @route   GET /api/orders/admin/stats
// @access  Private/Admin
// @desc    Get Admin Stats (Analytics)
// @route   GET /api/orders/admin/stats
// @access  Private/Admin
exports.getAdminStats = async (req, res) => {
  try {
    const orders = await Order.find({}).sort({ createdAt: -1 });
    const usersCount = await require('../models/User').countDocuments();
    const products = await require('../models/Product').find({});

    // 1. Total Sales & Orders (GROSS Realized Revenue)
    const totalSales = orders.reduce((acc, order) => acc + (order.isPaid ? order.totalPrice : 0), 0);
    const totalOrders = orders.length;

    // 2. Sales & Profit Analytics (Time Series)
    const { timeRange = 'daily' } = req.query; // 'daily', 'weekly', 'monthly', 'yearly'
    const salesMap = {};
    const profitMap = {}; // profit = revenue - cost
    const ordersMap = {};

    // Helper to get Date Key based on Range (Strict India Timezone UTC+5:30)
    // We add 5.5 hours to the UTC timestamp to align "days" with IST.
    const getIndiaDateKey = (dateObj, range) => {
      const d = new Date(dateObj);
      const utc = d.getTime();
      const indiaOffset = 5.5 * 60 * 60 * 1000;
      const indiaTime = new Date(utc + indiaOffset);

      if (range === 'weekly') {
        const day = indiaTime.getDay(); // 0-6 (Sun-Sat)
        const diff = indiaTime.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
        const monday = new Date(indiaTime.setDate(diff));
        return monday.toISOString().split('T')[0];
      }
      if (range === 'monthly') return `${indiaTime.getFullYear()}-${String(indiaTime.getMonth() + 1).padStart(2, '0')}`;
      if (range === 'yearly') return `${indiaTime.getFullYear()}`;
      return indiaTime.toISOString().split('T')[0];
    };

    // Date Filter Limit (Approximate lookback)
    const now = new Date();
    let pastDate = new Date();
    if (timeRange === 'weekly') pastDate.setMonth(now.getMonth() - 3);
    else if (timeRange === 'monthly') pastDate.setFullYear(now.getFullYear() - 1);
    else if (timeRange === 'yearly') pastDate.setFullYear(now.getFullYear() - 5);
    else pastDate.setDate(now.getDate() - 30);

    // Map Product Costs
    const productCostMap = {};
    products.forEach(p => {
      productCostMap[p._id.toString()] = p.costPrice || 0;
    });

    orders.forEach(order => {
      if (!order.isPaid) return; // Strict: Realized Revenue Only
      if (new Date(order.createdAt) < pastDate) return;

      // EXCLUDE Refunds/Returns from Performance Charts
      if (order.orderStatus === 'Returned' || order.orderStatus === 'Refunded') return;

      const dateKey = getIndiaDateKey(order.createdAt, timeRange);

      // Revenue
      salesMap[dateKey] = (salesMap[dateKey] || 0) + order.totalPrice;

      // Order Count
      if (!ordersMap[dateKey]) ordersMap[dateKey] = 0;
      ordersMap[dateKey]++;

      // Profit Calculation (Exact)
      let orderCost = 0;
      order.orderItems.forEach(item => {
        const pid = item.product?._id ? item.product._id.toString() : item.product.toString();
        // Use 0 if product deleted or no cost set
        const cost = productCostMap[pid] || 0;
        orderCost += cost * (item.qty || item.quantity);
      });

      // Profit = Revenue - Cost
      const orderProfit = order.totalPrice - orderCost;
      profitMap[dateKey] = (profitMap[dateKey] || 0) + orderProfit;
    });

    const chartData = Object.keys(salesMap).map(date => ({
      date,
      sales: salesMap[date], // Keep decimals if any
      orderCount: ordersMap[date] || 0,
      profit: profitMap[date] || 0,
      loss: salesMap[date] - (profitMap[date] || 0) // "Expenses"
    })).sort((a, b) => a.date.localeCompare(b.date)); // Robust string sort

    // 3. Recent Orders
    const recentOrdersWithUser = await Order.find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('user', 'firstName lastName email')
      .select('totalPrice isPaid createdAt user');

    // 4. Top Selling Products (REAL AGGREGATION)
    const productSalesCount = {};
    orders.forEach(o => {
      if (!o.isPaid) return; // Only count sold/paid items
      o.orderItems.forEach(item => {
        const pid = item.product?._id ? item.product._id.toString() : item.product.toString();
        productSalesCount[pid] = (productSalesCount[pid] || 0) + (item.qty || item.quantity);
      });
    });

    const topSellingProducts = products
      .map(p => ({
        _id: p._id,
        name: p.name,
        image: p.image,
        price: p.price,
        stock: p.countInStock,
        sold: productSalesCount[p._id.toString()] || 0
      }))
      .sort((a, b) => b.sold - a.sold)
      .slice(0, 5)
      .filter(p => p.sold > 0);

    // 5. Low Stock Alerts
    const lowStockProducts = products
      .filter(p => p.countInStock < 10)
      .sort((a, b) => a.countInStock - b.countInStock)
      .slice(0, 5)
      .map(p => ({
        _id: p._id,
        name: p.name,
        image: p.image,
        stock: p.countInStock
      }));

    // 6. Logistics Performance
    const deliveredOrders = orders.filter(o => o.isDelivered && o.deliveredAt && o.createdAt);
    let avgDeliveryDays = 0;
    if (deliveredOrders.length > 0) {
      const totalTime = deliveredOrders.reduce((acc, o) => {
        return acc + (new Date(o.deliveredAt) - new Date(o.createdAt));
      }, 0);
      // Precise rounded to 1 decimal
      avgDeliveryDays = parseFloat((totalTime / deliveredOrders.length / (1000 * 60 * 60 * 24)).toFixed(1));
    }

    // 7. Order Status Distribution (Donut)
    const statusCounts = orders.reduce((acc, order) => {
      const status = order.orderStatus || 'Pending';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
    const orderStatusDist = Object.keys(statusCounts).map(key => ({ name: key, value: statusCounts[key] }));

    // 8. Payment Method Distribution
    const paymentCounts = orders.reduce((acc, order) => {
      let method = order.paymentMethod || 'COD';
      if (method.toLowerCase() !== 'cod') method = 'Online';
      if (!acc[method]) acc[method] = { count: 0, amount: 0 };
      acc[method].count += 1;
      // Count amount only if Paid or COD (Potential)
      if (order.isPaid || method === 'COD') {
        acc[method].amount += order.totalPrice;
      }
      return acc;
    }, {});
    const paymentMethodDist = Object.keys(paymentCounts).map(key => ({
      name: key,
      value: paymentCounts[key].count,
      amount: paymentCounts[key].amount
    }));

    // --- DRILL DOWN DATA ---

    // A. Sales by Category (Real)
    const categorySalesMap = {};
    const productCatMap = {};
    products.forEach(p => productCatMap[p._id.toString()] = p.category || 'Uncategorized');

    orders.forEach(order => {
      // Precise: Align with Main Charts -> Paid Only
      if (!order.isPaid) return;
      order.orderItems.forEach(item => {
        const pid = item.product?._id ? item.product._id.toString() : item.product.toString();
        const cat = productCatMap[pid] || 'Other';
        categorySalesMap[cat] = (categorySalesMap[cat] || 0) + (item.price * (item.qty || item.quantity));
      });
    });
    const salesByCategory = Object.keys(categorySalesMap).map(key => ({ name: key, value: categorySalesMap[key] }));

    // B. User Growth
    const users = await require('../models/User').find({}).select('createdAt firstName lastName email');
    const userGrowthMap = {};
    users.forEach(u => {
      const d = new Date(u.createdAt);
      // User Growth also in IST
      const utc = d.getTime();
      const indiaOffset = 5.5 * 60 * 60 * 1000;
      const indiaTime = new Date(utc + indiaOffset);
      const key = `${indiaTime.getFullYear()}-${String(indiaTime.getMonth() + 1).padStart(2, '0')}`;
      userGrowthMap[key] = (userGrowthMap[key] || 0) + 1;
    });
    const userGrowth = Object.keys(userGrowthMap).map(date => ({ date, count: userGrowthMap[date] })).sort((a, b) => a.date.localeCompare(b.date));

    // C. Top Customers
    const userSpendMap = {};
    orders.forEach(o => {
      if (!o.isPaid) return; // Strict
      const uid = o.user?._id ? o.user._id.toString() : o.user ? o.user.toString() : 'guest';
      if (uid === 'guest') return;
      userSpendMap[uid] = (userSpendMap[uid] || 0) + o.totalPrice;
    });

    const userObjMap = {};
    users.forEach(u => userObjMap[u._id.toString()] = u);

    const topCustomers = Object.keys(userSpendMap)
      .map(uid => ({
        _id: uid,
        name: userObjMap[uid] ? `${userObjMap[uid].firstName} ${userObjMap[uid].lastName}` : 'Unknown',
        email: userObjMap[uid]?.email,
        totalSpend: userSpendMap[uid]
      }))
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .slice(0, 10);

    // 9. NEW METRICS
    // A. Today's Sales (IST)
    const nowIST = new Date(Date.now() + (3600000 * 5.5));
    const startOfTodaySTR = nowIST.toISOString().split('T')[0];

    const todaySales = orders.reduce((acc, order) => {
      const d = new Date(order.createdAt);
      const utc = d.getTime();
      const orderDateSTR = new Date(utc + (3600000 * 5.5)).toISOString().split('T')[0];

      return acc + (order.isPaid && orderDateSTR === startOfTodaySTR ? order.totalPrice : 0);
    }, 0);

    // B. AOV
    const avgOrderValue = totalOrders > 0 ? (totalSales / totalOrders).toFixed(0) : 0;

    // C. No Mock Data - Return Null/Empty if not tracked
    // User requested "Precise". Mocks are lies.
    const conversionRate = null;
    const trafficSrc = [];

    // D. Retention
    const userOrderCounts = {};
    orders.forEach(o => {
      const uid = o.user?._id ? o.user._id.toString() : o.user.toString();
      userOrderCounts[uid] = (userOrderCounts[uid] || 0) + 1;
    });
    let newCustomers = 0;
    let returningCustomers = 0;
    Object.values(userOrderCounts).forEach(count => {
      if (count === 1) newCustomers++;
      else if (count > 1) returningCustomers++;
    });

    // F. Failed/Refunds
    const failedPayments = orders.filter(o => o.orderStatus === 'Failed').length;
    const refundRequests = orders.filter(o => o.orderStatus === 'Returned').length;
    const refundsProcessed = orders.filter(o => o.orderStatus === 'Refunded').length;

    res.json({
      totalSales,
      totalOrders,
      totalUsers: usersCount,
      chartData,
      recentOrders: recentOrdersWithUser,
      topSellingProducts,
      lowStockProducts,
      avgDeliveryDays,
      orderStatusDist,
      paymentMethodDist,
      todaySales,
      avgOrderValue,
      conversionRate,
      customerRetention: { new: newCustomers, returning: returningCustomers },
      trafficSrc,
      failedPayments,
      refundRequests,
      refundsProcessed,
      salesByCategory,
      userGrowth,
      topCustomers
    });
  } catch (error) {
    console.error("STATS ERROR:", error);
    res.status(500).json({ message: "Stats failed" });
  }
};

// @desc    Cancel Order Item
// @route   PUT /api/orders/:id/cancel/:itemId
// @access  Private
exports.cancelOrderItem = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check authorization
    if (order.user.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    // Check dispatch status
    if (order.isDispatched) {
      return res.status(400).json({ message: 'Cannot cancel item: Order already dispatched' });
    }

    // Find item
    const item = order.orderItems.find(i => i._id.toString() === req.params.itemId);
    if (!item) {
      return res.status(404).json({ message: 'Item not found in order' });
    }

    if (item.status === 'Cancelled') {
      return res.status(400).json({ message: 'Item is already cancelled' });
    }

    item.status = 'Cancelled';

    // Recalculate Total Price? 
    // Usually for records we keep the "Charged" amount but maybe add a "Refund Amount". 
    // For this simple app, let's subtract from total to reflect "Payable".
    if (order.isPaid) {
      // If paid, we might need manual refund logic, but let's just update the record
      // order.totalPrice -= (item.price * item.qty);
    } else {
      order.totalPrice -= (item.price * item.qty);
    }

    await order.save();
    res.json(order);

  } catch (error) {
    console.error("CANCEL ERROR:", error);
    res.status(500).json({ message: 'Cancellation failed', error: error.message });
  }
};

// @desc    Delete Order
// @route   DELETE /api/orders/:id
// @access  Private/Admin
exports.deleteOrder = async (req, res) => {
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
exports.updateOrderToPaid = async (req, res) => {
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
exports.refundOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (order) {
      // Logic: Mark as refunded? 
      // For now, we don't have a specific 'Refunded' status in the schema for isPaid. 
      // We can toggle isPaid to false, OR set orderStatus to 'Returned'/'Cancelled'.
      // Let's assume Refund implies money back AND order cancellation.

      order.isPaid = false; // Money returned
      order.orderStatus = 'Returned'; // Stock logic might need handling if we want to restock

      // Optional: Auto-restock logic could go here if requested.

      const updatedOrder = await order.save();
      res.json(updatedOrder);
    } else {
      res.status(404).json({ message: 'Order not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Refund failed' });
  }
};

// @desc    Request Return/Exchange for Order Item
// @route   PUT /api/orders/:id/return/:itemId
// @access  Private
exports.requestReturn = async (req, res) => {
  try {
    const { reason, actionType } = req.body; // actionType: 'return' or 'exchange'
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check authorization
    if (order.user.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    // Check delivery status
    if (!order.isDelivered) {
      return res.status(400).json({ message: 'Cannot request return: Order not yet delivered' });
    }

    // Find item
    const item = order.orderItems.find(i => i._id.toString() === req.params.itemId);
    if (!item) {
      return res.status(404).json({ message: 'Item not found in order' });
    }

    if (item.status === 'Return Requested' || item.status === 'Exchange Requested') {
      return res.status(400).json({ message: 'Return/Exchange already requested for this item' });
    }

    if (item.status === 'Returned' || item.status === 'Exchanged') {
      return res.status(400).json({ message: 'Item already processed' });
    }

    // Update Item Status
    item.status = actionType === 'exchange' ? 'Exchange Requested' : 'Return Requested';
    item.returnReason = reason || 'No reason provided';

    await order.save();
    res.json(order);

  } catch (error) {
    console.error("RETURN ERROR:", error);
    res.status(500).json({ message: 'Return request failed', error: error.message });
  }
};