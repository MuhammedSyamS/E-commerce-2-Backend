const PDFDocument = require('pdfkit');
const Order = require('../models/Order');

const generateInvoice = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('user', 'firstName lastName email'); // Populate user details

        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        // Create a document
        const doc = new PDFDocument({ margin: 50 });

        // Set correct headers for download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice-${order._id}.pdf`);

        // Pipe PDF to response
        doc.pipe(res);

        // --- HEADER ---
        doc
            .fontSize(20)
            .font('Helvetica-Bold')
            .text('SLOOK', 50, 50)
            .fontSize(10)
            .font('Helvetica')
            .text('INVOICE / RECEIPT', 50, 80)
            .moveDown();

        // --- ORDER DETAILS ---
        const customerName = order.user ? `${order.user.firstName} ${order.user.lastName}` : "Valued Customer";
        const orderDate = new Date(order.createdAt).toLocaleDateString();

        doc
            .fontSize(10)
            .text(`Order ID: ${order._id}`, 50, 120)
            .text(`Date: ${orderDate}`, 50, 135)
            .text(`Status: ${order.orderStatus}`, 50, 150)
            .moveDown();

        doc
            .text(`Issued To:`, 300, 120)
            .font('Helvetica-Bold')
            .text(customerName, 300, 135)
            .font('Helvetica')
            .text(order.shippingAddress?.address || '', 300, 150)
            .text(`${order.shippingAddress?.city}, ${order.shippingAddress?.postalCode}`, 300, 165)
            .text(order.shippingAddress?.country || '', 300, 180);

        // --- LINE ITEMS HEADER ---
        doc.moveDown(4);
        const tableTop = 250;

        doc.font('Helvetica-Bold');
        doc.text('Item', 50, tableTop);
        doc.text('Qty', 280, tableTop);
        doc.text('Price', 340, tableTop);
        doc.text('Total', 450, tableTop);

        doc
            .moveTo(50, tableTop + 15)
            .lineTo(550, tableTop + 15)
            .stroke();

        // --- LINE ITEMS ---
        let y = tableTop + 30;
        doc.font('Helvetica');

        order.orderItems.forEach(item => {
            const itemTotal = item.qty * item.price;

            // Truncate name if too long
            const itemName = item.name.length > 40 ? item.name.substring(0, 37) + '...' : item.name;

            doc.text(itemName, 50, y);
            doc.text(item.qty.toString(), 280, y);
            doc.text(`INR ${item.price}`, 340, y);
            doc.text(`INR ${itemTotal}`, 450, y);

            y += 20;
        });

        // --- TOTALS ---
        doc
            .moveTo(50, y + 10)
            .lineTo(550, y + 10)
            .stroke();

        y += 20;

        doc.font('Helvetica-Bold');
        doc.text(`Grand Total: INR ${order.totalPrice}`, 400, y);

        // --- FOOTER ---
        doc
            .fontSize(10)
            .text('Thank you for shopping with SLOOK.', 50, 700, { align: 'center', width: 500 });

        doc.end();

    } catch (error) {
        console.error("INVOICE ERROR:", error);
        // If headers already sent (stream started), we can't send JSON error
        if (!res.headersSent) {
            res.status(500).json({ message: "Failed to generate invoice." });
        }
    }
};

module.exports = { generateInvoice };
