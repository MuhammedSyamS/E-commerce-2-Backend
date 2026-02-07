const PDFDocument = require('pdfkit');
const Order = require('../models/Order');
const path = require('path');
const fs = require('fs');

// @desc    Generate PDF Invoice
// @route   GET /api/orders/:id/invoice
// @access  Private
const generateInvoice = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id).populate('user', 'name email');

        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        // Authorization Check
        if (order.user._id.toString() !== req.user._id.toString() && !req.user.isAdmin) {
            return res.status(401).json({ message: "Not authorized" });
        }

        const doc = new PDFDocument({ margin: 50 });

        // Set Response Headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice_${order._id}.pdf`);

        // Pipe to Response
        doc.pipe(res);

        // --- PDF CONTENT ---

        // 1. Header
        doc.fontSize(20).text('HighPhaus Invoice', { align: 'center' });
        doc.moveDown();

        // 2. Company Info & Order Details
        doc.fontSize(10).text('HighPhaus Inc.', 50, 80);
        doc.text('123 Luxury Lane, Kerala, India', 50, 95);
        doc.text('support@highphaus.com', 50, 110);

        doc.text(`Invoice Number: INV-${order._id.toString().slice(-6).toUpperCase()}`, 400, 80);
        doc.text(`Order Date: ${new Date(order.createdAt).toDateString()}`, 400, 95);
        doc.text(`Status: ${order.isPaid ? 'PAID' : 'PENDING'}`, 400, 110);

        doc.moveDown(4);

        // 3. Billing To
        doc.font('Helvetica-Bold').text('Bill To:', 50, 150);
        doc.font('Helvetica').text(order.shippingAddress.address, 50, 165);
        doc.text(`${order.shippingAddress.city} - ${order.shippingAddress.postalCode}`, 50, 180);
        doc.text(`Phone: ${order.shippingAddress.phone}`, 50, 195);

        doc.moveDown();

        // 4. Items Table Header
        const tableTop = 250;
        doc.font('Helvetica-Bold');
        doc.text('Item', 50, tableTop);
        doc.text('Qty', 350, tableTop); // shifted right
        doc.text('Price', 400, tableTop);
        doc.text('Total', 500, tableTop, { align: 'right' }); // aligned right
        doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

        let position = tableTop + 30;

        // 5. Items Loop
        doc.font('Helvetica');
        order.orderItems.forEach(item => {
            const totalPrice = item.qty * item.price;

            // Item Name (Truncate if too long)
            doc.text(item.name.substring(0, 45), 50, position);
            doc.text(item.qty.toString(), 350, position);
            doc.text(`INR ${item.price}`, 400, position);
            doc.text(`INR ${totalPrice}`, 500, position, { align: 'right' });

            position += 20;
        });

        // 6. Totals
        doc.moveTo(50, position + 10).lineTo(550, position + 10).stroke();
        position += 25;

        doc.font('Helvetica-Bold');
        doc.text('Grand Total:', 400, position);
        doc.text(`INR ${order.totalPrice}`, 500, position, { align: 'right' });

        // 7. Footer
        doc.fontSize(10).text('Thank you for shopping with HighPhaus.', 50, 700, { align: 'center', width: 500 });


        doc.end();

    } catch (error) {
        console.error("Invoice Gen Error:", error);
        res.status(500).json({ message: "Invoice generation failed" });
    }
};

module.exports = { generateInvoice };
