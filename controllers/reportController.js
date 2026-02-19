const Order = require('../models/Order');
const User = require('../models/User');
const Product = require('../models/Product');
const PDFDocument = require('pdfkit');

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
// @desc    Get Sales Report PDF
// @route   GET /api/reports/sales/pdf
// @access  Private/Admin
exports.getSalesReportPDF = async (req, res) => {
    try {
        const { range = '30d' } = req.query;

        const now = new Date();
        let startDate = new Date();
        if (range === '7d') startDate.setDate(now.getDate() - 7);
        else if (range === '1y') startDate.setFullYear(now.getFullYear() - 1);
        else startDate.setDate(now.getDate() - 30);

        const matchStage = {
            orderStatus: { $nin: ['Cancelled', 'Returned'] },
            createdAt: { $gte: startDate }
        };

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
            { $limit: 10 }
        ]);

        const stats = summaryStats[0] || { totalRevenue: 0, totalOrders: 0, avgOrderValue: 0 };

        const doc = new PDFDocument({ margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=sales_report_${range}.pdf`);
        doc.pipe(res);

        // Header
        doc.fillColor('#000000').fontSize(24).font('Helvetica-Bold').text('SLOOK SALES REPORT', 50, 50);
        doc.fontSize(10).font('Helvetica').text(`Range: ${range.toUpperCase()}`, 50, 80);
        doc.text(`Generated At: ${new Date().toLocaleString()}`, 50, 95);
        doc.moveTo(50, 115).lineTo(550, 115).stroke();

        // Summary Cards
        doc.fontSize(14).font('Helvetica-Bold').text('Executive Summary', 50, 140);
        doc.fontSize(10).font('Helvetica')
            .text(`Total Revenue: ₹${stats.totalRevenue.toLocaleString()}`, 70, 165)
            .text(`Total Orders: ${stats.totalOrders}`, 70, 180)
            .text(`Avg. Order Value: ₹${Math.round(stats.avgOrderValue).toLocaleString()}`, 70, 195);

        // Top Products Table
        let y = 240;
        doc.fontSize(14).font('Helvetica-Bold').text('Top Performing Products', 50, y);
        y += 25;
        doc.fontSize(10).font('Helvetica-Bold')
            .text('Product Name', 50, y)
            .text('QTY', 350, y)
            .text('Revenue', 450, y);

        doc.moveTo(50, y + 15).lineTo(550, y + 15).stroke();
        y += 25;

        topProducts.forEach(p => {
            doc.font('Helvetica').fontSize(9)
                .text(p.name, 50, y, { width: 280 })
                .text(p.qty.toString(), 350, y)
                .text(`₹${p.revenue.toLocaleString()}`, 450, y);
            y += 20;
        });

        doc.fontSize(8).fillColor('#888888').text('SLOOK eCommerce Platform - Confidential Admin Report', 50, 750, { align: 'center', width: 500 });

        doc.end();

    } catch (error) {
        console.error("PDF Sales Report Error:", error);
        res.status(500).json({ message: "Failed to generate PDF report" });
    }
};

// @desc    Get User Growth PDF
// @route   GET /api/reports/users/pdf
// @access  Private/Admin
exports.getUserGrowthReportPDF = async (req, res) => {
    try {
        const topCustomers = await Order.aggregate([
            { $match: { orderStatus: { $nin: ['Cancelled'] } } },
            {
                $group: {
                    _id: "$user",
                    totalSpend: { $sum: "$totalPrice" },
                    orderCount: { $sum: 1 }
                }
            },
            { $sort: { totalSpend: -1 } },
            { $limit: 15 },
            {
                $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "_id",
                    as: "userDetails"
                }
            },
            { $unwind: "$userDetails" }
        ]);

        const doc = new PDFDocument({ margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=user_report.pdf');
        doc.pipe(res);

        doc.fillColor('#000000').fontSize(24).font('Helvetica-Bold').text('SLOOK USER INSIGHTS', 50, 50);
        doc.fontSize(10).font('Helvetica').text(`Generated At: ${new Date().toLocaleString()}`, 50, 80);
        doc.moveTo(50, 100).lineTo(550, 100).stroke();

        doc.fontSize(14).font('Helvetica-Bold').text('Top Spenders (Customer Loyalty)', 50, 130);

        let y = 160;
        doc.fontSize(10).font('Helvetica-Bold')
            .text('Customer', 50, y)
            .text('Orders', 350, y)
            .text('Total Spend', 450, y);

        doc.moveTo(50, y + 15).lineTo(550, y + 15).stroke();
        y += 25;

        topCustomers.forEach(c => {
            doc.font('Helvetica').fontSize(9)
                .text(`${c.userDetails.firstName} ${c.userDetails.lastName}\n(${c.userDetails.email})`, 50, y, { width: 280 })
                .text(c.orderCount.toString(), 350, y)
                .text(`₹${c.totalSpend.toLocaleString()}`, 450, y);
            y += 35;
        });

        doc.end();
    } catch (error) {
        console.error("PDF User Report Error:", error);
        res.status(500).json({ message: "Failed to generate PDF report" });
    }
};
// @desc    Get Order Operations Report PDF
// @route   GET /api/reports/orders/pdf
// @access  Private/Admin
exports.getOrderReportPDF = async (req, res) => {
    try {
        const now = new Date();
        const startDate = new Date();
        startDate.setDate(now.getDate() - 30);

        // 1. Order Status Distribution
        const orderStatusDist = await Order.aggregate([
            { $group: { _id: "$orderStatus", value: { $sum: 1 } } },
            { $project: { name: "$_id", value: 1, _id: 0 } }
        ]);

        // 2. Daily Order Volume
        const orderVolume = await Order.aggregate([
            { $match: { createdAt: { $gte: startDate } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // 3. Problematic Orders (Returns & Failed Payments)
        // Note: Failed payments logic depends on your implementation. 
        // If we don't have a 'failed' flag, we check isPaid: false for non-COD.
        const returnRequests = await Order.countDocuments({
            'orderItems.status': { $in: ['Return Requested', 'Exchange Requested'] }
        });

        const failedPayments = await Order.countDocuments({
            isPaid: false,
            paymentMethod: { $ne: 'COD' },
            createdAt: { $gte: startDate }
        });

        const avgDeliveryStats = await Order.aggregate([
            { $match: { isDelivered: true, deliveredAt: { $ne: null } } },
            { $project: { duration: { $divide: [{ $subtract: ["$deliveredAt", "$createdAt"] }, 86400000] } } },
            { $group: { _id: null, avg: { $avg: "$duration" } } }
        ]);
        const avgDeliveryDays = avgDeliveryStats[0]?.avg?.toFixed(1) || 'N/A';

        const doc = new PDFDocument({ margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=order_operations_report.pdf');
        doc.pipe(res);

        // Header
        doc.fillColor('#000000').fontSize(24).font('Helvetica-Bold').text('ORDER OPERATIONS REPORT', 50, 50);
        doc.fontSize(10).font('Helvetica').text(`Generated At: ${new Date().toLocaleString()}`, 50, 80);
        doc.moveTo(50, 100).lineTo(550, 100).stroke();

        // Section 1: Fulfillment Summary
        doc.fontSize(16).font('Helvetica-Bold').text('Fulfillment Summary', 50, 130);
        let y = 160;
        doc.fontSize(10).font('Helvetica')
            .text(`Total Returns In-Flight: ${returnRequests}`, 70, y)
            .text(`Failed Payments (30d): ${failedPayments}`, 70, y + 20)
            .text(`Avg. Delivery Time: ${avgDeliveryDays} days`, 70, y + 40);

        // Section 2: Order Status Distribution
        y = 240;
        doc.fontSize(16).font('Helvetica-Bold').text('Order Status Distribution', 50, y);
        y += 30;
        doc.fontSize(10).font('Helvetica-Bold')
            .text('Status', 50, y)
            .text('Count', 450, y);
        doc.moveTo(50, y + 15).lineTo(550, y + 15).stroke();
        y += 25;

        orderStatusDist.forEach(item => {
            doc.font('Helvetica').fontSize(10)
                .text(item.name || 'Unknown', 50, y)
                .text(item.value.toString(), 450, y);
            y += 20;
        });

        // Section 3: Daily Volume (Last 7 entries for brevity in PDF)
        y += 30;
        if (y > 650) { doc.addPage(); y = 50; }
        doc.fontSize(16).font('Helvetica-Bold').text('Daily Order Volume (Recent)', 50, y);
        y += 30;
        doc.fontSize(10).font('Helvetica-Bold')
            .text('Date', 50, y)
            .text('Orders', 450, y);
        doc.moveTo(50, y + 15).lineTo(550, y + 15).stroke();
        y += 25;

        orderVolume.slice(-10).forEach(item => {
            doc.font('Helvetica').fontSize(10)
                .text(item._id, 50, y)
                .text(item.count.toString(), 450, y);
            y += 20;
        });

        doc.fontSize(8).fillColor('#888888').text('SLOOK Operations Center - Internal Performance Data', 50, 750, { align: 'center', width: 500 });

        doc.end();
    } catch (error) {
        console.error("PDF Order Report Error:", error);
        res.status(500).json({ message: "Failed to generate PDF report" });
    }
};
