const PDFDocument = require('pdfkit');
const Order = require('../models/Order');

// @desc    Generate PDF Invoice for an order
// @route   GET /api/orders/:id/invoice
// @access  Private
exports.generateInvoice = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id).populate('user', 'firstName lastName email');

        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        // Check if user is owner or admin
        if (order.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(401).json({ message: "Not authorized to view this invoice" });
        }

        const doc = new PDFDocument({ margin: 50 });

        // Stream the PDF to the response
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice_${order._id}.pdf`);
        doc.pipe(res);

        // --- HEADER ---
        doc
            .fillColor('#444444')
            .fontSize(20)
            .text('SLOOK', 50, 50)
            .fontSize(10)
            .text('Premium E-Commerce Studio', 50, 80)
            .text('support@slook.com', 50, 95)
            .moveDown();

        // --- INVOICE INFO ---
        doc
            .fillColor('#000000')
            .fontSize(20)
            .text('INVOICE', 50, 160);

        doc
            .fontSize(10)
            .text(`Invoice Number: ${order._id}`, 50, 200)
            .text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`, 50, 215)
            .text(`Status: ${order.orderStatus.toUpperCase()}`, 50, 230)
            .moveDown();

        // --- CUSTOMER INFO ---
        doc
            .fontSize(10)
            .text('BILL TO:', 300, 200)
            .font('Helvetica-Bold')
            .text(`${order.user.firstName} ${order.user.lastName}`, 300, 215)
            .font('Helvetica')
            .text(order.user.email, 300, 230)
            .text(order.shippingAddress.address, 300, 245)
            .text(`${order.shippingAddress.city}, ${order.shippingAddress.postalCode}`, 300, 260)
            .moveDown();

        // --- TABLE HEADER ---
        const tableTop = 330;
        doc
            .font('Helvetica-Bold')
            .text('Item Description', 50, tableTop)
            .text('Qty', 280, tableTop)
            .text('Unit Price', 350, tableTop)
            .text('Total', 450, tableTop);

        doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

        // --- TABLE ITEMS ---
        let i = 0;
        order.orderItems.forEach(item => {
            const y = tableTop + 30 + (i * 25);
            doc
                .font('Helvetica')
                .text(item.name, 50, y)
                .text(item.qty.toString(), 280, y)
                .text(`₹${item.price.toLocaleString()}`, 350, y)
                .text(`₹${(item.qty * item.price).toLocaleString()}`, 450, y);
            i++;
        });

        // --- TOTALS ---
        const subtotal = order.orderItems.reduce((acc, item) => acc + (item.qty * item.price), 0);
        const totalsTop = tableTop + 50 + (i * 25);

        doc.moveTo(350, totalsTop).lineTo(550, totalsTop).stroke();

        doc
            .fontSize(10)
            .text('Subtotal:', 350, totalsTop + 10)
            .text(`₹${subtotal.toLocaleString()}`, 450, totalsTop + 10)
            .text('Discount:', 350, totalsTop + 25)
            .text(`- ₹${order.discountAmount.toLocaleString()}`, 450, totalsTop + 25)
            .text('Tax:', 350, totalsTop + 40)
            .text(`₹${order.taxPrice.toLocaleString()}`, 450, totalsTop + 40)
            .text('Shipping:', 350, totalsTop + 55)
            .text(`₹${order.shippingPrice.toLocaleString()}`, 450, totalsTop + 55)
            .fontSize(12)
            .font('Helvetica-Bold')
            .text('TOTAL:', 350, totalsTop + 75)
            .text(`₹${order.totalPrice.toLocaleString()}`, 450, totalsTop + 75);

        // --- FOOTER ---
        doc
            .fontSize(10)
            .font('Helvetica')
            .text('Thank you for shopping with SLOOK.', 50, 700, { align: 'center', width: 500 });

        doc.end();
    } catch (error) {
        console.error("PDF ERROR:", error);
        res.status(500).json({ message: "Failed to generate invoice" });
    }
};

// @desc    Generate Packing Manifest for an order (Warehouse Optimized)
// @route   GET /api/orders/:id/manifest
// @access  Private/Admin/Manager
exports.generateManifest = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id).populate('user', 'firstName lastName');

        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        const doc = new PDFDocument({ margin: 50 });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=manifest_${order._id}.pdf`);
        doc.pipe(res);

        // --- HEADER ---
        doc
            .fillColor('#000000')
            .fontSize(24)
            .font('Helvetica-Bold')
            .text('SHIPPING MANIFEST', 50, 50);

        doc
            .fontSize(10)
            .font('Helvetica')
            .text(`Order ID: #${order._id}`, 50, 80)
            .text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`, 50, 95);

        doc.moveTo(50, 115).lineTo(550, 115).stroke();

        // --- DESTINATION ---
        doc
            .fontSize(12)
            .font('Helvetica-Bold')
            .text('SHIP TO:', 50, 140)
            .fontSize(10)
            .font('Helvetica')
            .text(`${order.user.firstName} ${order.user.lastName}`, 50, 160)
            .text(order.shippingAddress.address, 50, 175)
            .text(`${order.shippingAddress.city}, ${order.shippingAddress.postalCode}`, 50, 190)
            .text(`Ph: ${order.shippingAddress.phone}`, 50, 205);

        // --- SPECIAL INSTRUCTIONS ---
        if (order.orderNote) {
            doc.rect(300, 140, 250, 80).stroke();
            doc
                .fontSize(10)
                .font('Helvetica-Bold')
                .text('SPECIAL INSTRUCTIONS:', 310, 150)
                .fontSize(9)
                .font('Helvetica-Oblique')
                .text(order.orderNote, 310, 170, { width: 230 });
        }

        // --- PACKING LIST ---
        doc
            .fillColor('#000000')
            .fontSize(14)
            .font('Helvetica-Bold')
            .text('PACKING LIST', 50, 250);

        const tableTop = 280;
        doc
            .fontSize(10)
            .text('QTY', 50, tableTop)
            .text('ITEM DESCRIPTION', 100, tableTop)
            .text('SKU / VARIANT', 400, tableTop);

        doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

        let i = 0;
        order.orderItems.forEach(item => {
            const y = tableTop + 30 + (i * 40);

            // Qty in Box
            doc.rect(50, y - 5, 25, 25).stroke();

            doc
                .fontSize(12)
                .font('Helvetica-Bold')
                .text(item.qty.toString(), 58, y)
                .fontSize(10)
                .font('Helvetica')
                .text(item.name, 100, y)
                .fontSize(8)
                .text(`${item.selectedVariant?.size || 'N/A'} / ${item.selectedVariant?.color || 'N/A'}`, 400, y);

            doc.moveTo(50, y + 25).lineTo(550, y + 25).dash(5, { space: 10 }).stroke().undash();
            i++;
        });

        // --- FOOTER ---
        doc
            .fontSize(8)
            .font('Helvetica')
            .text('CONFIDENTIAL - WAREHOUSE USE ONLY', 50, 700, { align: 'center', width: 500 });

        doc.end();
    } catch (error) {
        console.error("MANIFEST PDF ERROR:", error);
        res.status(500).json({ message: "Failed to generate manifest" });
    }
};
