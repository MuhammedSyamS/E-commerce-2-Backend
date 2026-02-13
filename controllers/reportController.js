const Order = require('../models/Order');
const User = require('../models/User');
const Product = require('../models/Product');

// @desc    Get Sales Report (Daily/Monthly)
// @route   GET /api/reports/sales
// @access  Private/Admin
// @desc    Get Sales Report (Daily/Monthly + Summary + Top Products + Categories)
// @route   GET /api/reports/sales
// @access  Private/Admin
exports.getSalesReport = async (req, res) => {
    try {
        const { range = '30d' } = req.query; // '7d', '30d', '1y'

        const now = new Date();
        let startDate = new Date();

        if (range === '7d') startDate.setDate(now.getDate() - 7);
        else if (range === '1y') startDate.setFullYear(now.getFullYear() - 1);
        else startDate.setDate(now.getDate() - 30); // Default 30d

        const matchStage = {
            orderStatus: { $nin: ['Cancelled', 'Returned'] }, // Include Pending/COD orders
            createdAt: { $gte: startDate }
        };

        // 1. TIMELINE DATA (Daily/Monthly)
        const salesTimeline = await Order.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    revenue: { $sum: "$totalPrice" },
                    orders: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // 2. SUMMARY STATS (Total Rev, Total Orders, Avg Order Value)
        const summaryStats = await Order.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: "$totalPrice" },
                    totalOrders: { $sum: 1 },
                    avgOrderValue: { $avg: "$totalPrice" }
                }
            }
        ]);

        // 3. TOP SELLING PRODUCTS
        const topProducts = await Order.aggregate([
            { $match: matchStage },
            { $unwind: "$orderItems" },
            {
                $group: {
                    _id: "$orderItems.product",
                    name: { $first: "$orderItems.name" },
                    qty: { $sum: "$orderItems.qty" },
                    revenue: { $sum: { $multiply: ["$orderItems.price", "$orderItems.qty"] } }
                }
            },
            { $sort: { qty: -1 } },
            { $limit: 5 }
        ]);

        // 4. CATEGORY BREAKDOWN (Need to lookup Product to get category)
        const categoryStats = await Order.aggregate([
            { $match: matchStage },
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
                    revenue: { $sum: { $multiply: ["$orderItems.price", "$orderItems.qty"] } },
                    count: { $sum: "$orderItems.qty" }
                }
            },
            { $sort: { revenue: -1 } }
        ]);

        res.json({
            timeline: salesTimeline,
            summary: summaryStats[0] || { totalRevenue: 0, totalOrders: 0, avgOrderValue: 0 },
            topProducts,
            categoryStats
        });
    } catch (error) {
        console.error("Report Generation Error:", error);
        res.status(500).json({ message: "Failed to generate sales report" });
    }
};

// @desc    Get User Growth Report
// @route   GET /api/reports/users
// @access  Private/Admin
exports.getUserGrowthReport = async (req, res) => {
    try {
        const users = await User.aggregate([
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } },
            { $limit: 30 } // Last 30 days essentially if sorted
        ]);
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: "Failed to generate user report" });
    }
};

// @desc    Get Top Products in Carts (Potential Sales)
// @route   GET /api/reports/top-cart
// @access  Private/Admin
exports.getTopCartProducts = async (req, res) => {
    try {
        const topCartProducts = await User.aggregate([
            // 1. Filter only users with items in cart
            { $match: { "cart.0": { $exists: true } } },
            // 2. Unwind cart items (one doc per item)
            { $unwind: "$cart" },
            // 3. Group by Product ID
            {
                $group: {
                    _id: "$cart.product",
                    count: { $sum: 1 }, // Count users who have this in cart
                    qty: { $sum: "$cart.quantity" } // Total quantity demanded (optional)
                }
            },
            // 4. Sort by User Count (Popularity)
            { $sort: { count: -1 } },
            // 5. Limit (Top 10)
            { $limit: 10 },
            // 6. Lookup Product Details
            {
                $lookup: {
                    from: "products",
                    localField: "_id",
                    foreignField: "_id",
                    as: "productDetails"
                }
            },
            // 7. Unwind Product Details
            { $unwind: "$productDetails" },
            // 8. Project needed fields
            {
                $project: {
                    _id: 1,
                    name: "$productDetails.name",
                    image: "$productDetails.image",
                    price: "$productDetails.price",
                    stock: "$productDetails.countInStock",
                    count: 1,
                    qty: 1
                }
            }
        ]);

        res.json(topCartProducts);
    } catch (error) {
        console.error("Top Cart Report Error:", error);
        res.status(500).json({ message: "Failed to generate cart report" });
    }
};
