const PDFDocument = require('pdfkit');
const Order = require('../models/Order');

// @desc    Generate PDF Invoice for an order
// @route   GET /api/orders/:id/invoice
// @access  Private
exports.generateInvoice = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id).populate('user', 'firstName lastName email phone');

        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        // Check if user is owner or admin
        if (order.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(401).json({ message: "Not authorized to view this invoice" });
        }

        const doc = new PDFDocument({ margin: 0, size: 'A4' });

        // Stream the PDF to the response
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice_${order._id}.pdf`);
        doc.pipe(res);

        const invoiceNo = `SLK-${order._id.toString().slice(-8).toUpperCase()}`;

        // --- BLACK HEADER ---
        doc.rect(0, 0, 612, 80).fill('#09090b');
        
        doc.fillColor('#ffffff')
           .fontSize(22)
           .font('Helvetica-Bold')
           .text('SLOOK', 40, 25, { characterSpacing: -1 });
           
        doc.fontSize(8)
           .font('Helvetica')
           .fillColor('#a1a1aa')
           .text('PREMIUM E-COMMERCE STUDIO', 40, 52, { characterSpacing: 2 });

        doc.fillColor('#a1a1aa')
           .fontSize(9)
           .text('Tax Invoice / Bill of Supply', 400, 25, { align: 'right', width: 170 });
           
        doc.fillColor('#ffffff')
           .fontSize(12)
           .font('Helvetica-Bold')
           .text(`#${invoiceNo}`, 400, 42, { align: 'right', width: 170 });

        // --- TAX INFO BAR ---
        doc.rect(0, 80, 612, 35).fill('#f9fafb');
        doc.fillColor('#71717a')
           .fontSize(7)
           .font('Helvetica-Bold')
           .text('GSTIN: ', 40, 93, { continued: true })
           .fillColor('#27272a')
           .text('27AAAAA0000A1Z5', { continued: true })
           .fillColor('#71717a')
           .text('   PAN: ', { continued: true })
           .fillColor('#27272a')
           .text('AAAAA0000A');

        doc.fillColor('#71717a')
           .text('Place of Supply: ', 350, 93, { align: 'right', width: 220, continued: true })
           .fillColor('#27272a')
           .text(order.shippingAddress.city.toUpperCase(), { continued: true })
           .fillColor('#71717a')
           .text('   Reverse Charge: ', { continued: true })
           .fillColor('#27272a')
           .text('NO');

        // --- META BAR (3 COLUMNS) ---
        doc.rect(0, 115, 612, 40).fill('#f9fafb');
        doc.strokeColor('#e4e4e7').moveTo(0, 115).lineTo(612, 115).stroke();
        doc.moveTo(0, 155).lineTo(612, 155).stroke();
        
        // Vertical dividers
        doc.moveTo(204, 115).lineTo(204, 155).stroke();
        doc.moveTo(408, 115).lineTo(408, 155).stroke();

        doc.fillColor('#a1a1aa').fontSize(7).font('Helvetica-Bold').text('ORDER DATE', 40, 125, { width: 164, align: 'center' });
        doc.fillColor('#09090b').fontSize(10).text(new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }), 40, 137, { width: 164, align: 'center' });

        doc.fillColor('#a1a1aa').text('PAYMENT', 204, 125, { width: 204, align: 'center' });
        doc.fillColor('#09090b').text(order.paymentMethod.toUpperCase(), 204, 137, { width: 204, align: 'center' });

        doc.fillColor('#a1a1aa').text('STATUS', 408, 125, { width: 164, align: 'center' });
        doc.fillColor(order.isPaid ? '#059669' : '#d97706').text(order.isPaid ? 'PAID' : 'PENDING', 408, 137, { width: 164, align: 'center' });

        // --- BILL / SHIP TO ---
        const addrY = 180;
        doc.fillColor('#a1a1aa').fontSize(7).font('Helvetica-Bold').text('BILLED TO', 40, addrY);
        doc.fillColor('#09090b').fontSize(10).text(`${order.user.firstName} ${order.user.lastName}`, 40, addrY + 12);
        doc.fillColor('#71717a').fontSize(9).font('Helvetica').text(order.user.email, 40, addrY + 25);
        if (order.user.phone) doc.text(order.user.phone, 40, addrY + 38);

        doc.fillColor('#a1a1aa').fontSize(7).font('Helvetica-Bold').text('SHIP TO', 350, addrY, { align: 'right', width: 220 });
        doc.fillColor('#09090b').fontSize(10).text(order.shippingAddress.address, 350, addrY + 12, { align: 'right', width: 220 });
        doc.fillColor('#71717a').fontSize(9).font('Helvetica').text(`${order.shippingAddress.city}, ${order.shippingAddress.postalCode}`, 350, addrY + 25, { align: 'right', width: 220 });
        doc.text(order.shippingAddress.phone, 350, addrY + 38, { align: 'right', width: 220 });

        // --- TABLE ---
        const tableTop = 260;
        doc.strokeColor('#e4e4e7').moveTo(40, tableTop).lineTo(572, tableTop).stroke();
        
        doc.fillColor('#a1a1aa').fontSize(7).font('Helvetica-Bold')
           .text('#', 40, tableTop + 8)
           .text('DESCRIPTION', 70, tableTop + 8)
           .text('HSN', 320, tableTop + 8, { width: 40, align: 'center' })
           .text('QTY', 370, tableTop + 8, { width: 30, align: 'center' })
           .text('RATE', 410, tableTop + 8, { width: 70, align: 'right' })
           .text('TOTAL', 490, tableTop + 8, { width: 82, align: 'right' });

        doc.moveTo(40, tableTop + 22).lineTo(572, tableTop + 22).stroke();

        let currentY = tableTop + 35;
        order.orderItems.forEach((item, index) => {
            doc.fillColor('#a1a1aa').fontSize(9).font('Helvetica').text(String(index + 1).padStart(2, '0'), 40, currentY);
            
            doc.fillColor('#09090b').font('Helvetica-Bold').text(item.name, 70, currentY);
            if (item.selectedVariant) {
                const variantText = `${item.selectedVariant.size ? `Size: ${item.selectedVariant.size}` : ''}${item.selectedVariant.size && item.selectedVariant.color ? ' · ' : ''}${item.selectedVariant.color ? `Color: ${item.selectedVariant.color}` : ''}`;
                doc.fillColor('#a1a1aa').font('Helvetica').fontSize(7).text(variantText, 70, currentY + 12);
            }

            doc.fillColor('#71717a').fontSize(8).font('Helvetica').text('610910', 320, currentY, { width: 40, align: 'center' });
            doc.fillColor('#09090b').fontSize(9).font('Helvetica-Bold').text(item.qty.toString(), 370, currentY, { width: 30, align: 'center' });
            doc.fillColor('#09090b').font('Helvetica').text(`₹${item.price.toLocaleString()}`, 410, currentY, { width: 70, align: 'right' });
            doc.fillColor('#09090b').font('Helvetica-Bold').text(`₹${(item.qty * item.price).toLocaleString()}`, 490, currentY, { width: 82, align: 'right' });

            currentY += item.selectedVariant ? 35 : 25;
            
            // Draw thin line between items
            doc.strokeColor('#f4f4f5').moveTo(40, currentY - 5).lineTo(572, currentY - 5).stroke();
        });

        // --- TOTALS ---
        const subtotal = order.orderItems.reduce((acc, item) => acc + (item.qty * item.price), 0);
        let totalsY = currentY + 10;
        const colX = 380;
        const valX = 490;

        doc.strokeColor('#27272a').lineWidth(1.5).moveTo(colX, totalsY).lineTo(572, totalsY).stroke().lineWidth(1);
        totalsY += 12;

        const drawTotalRow = (label, val, color = '#71717a', fontSize = 8, isBold = false) => {
            doc.fillColor(color).fontSize(fontSize).font(isBold ? 'Helvetica-Bold' : 'Helvetica').text(label, colX, totalsY);
            const displayVal = (label === 'Shipping' && val === 0) ? 'FREE' : `₹${val.toLocaleString()}`;
            doc.text(displayVal, valX, totalsY, { align: 'right', width: 82 });
            totalsY += 15;
        };

        drawTotalRow('Subtotal', subtotal);
        if (order.discountAmount > 0) {
            drawTotalRow(`Discount ${order.couponCode ? `(${order.couponCode})` : ''}`, -(order.discountAmount || 0), '#059669');
        }
        if (order.loyaltyDiscount > 0) {
            drawTotalRow(`SLOOK Coins (${order.loyaltyPointsUsed || 0})`, -(order.loyaltyDiscount), '#7c3aed');
        }
        drawTotalRow('Shipping', (order.shippingPrice || 0));
        drawTotalRow('Tax (GST)', (order.taxPrice || 0));

        doc.strokeColor('#09090b').lineWidth(2).moveTo(colX, totalsY).lineTo(572, totalsY).stroke().lineWidth(1);
        totalsY += 10;
        doc.fillColor('#09090b').fontSize(11).font('Helvetica-Bold').text('GRAND TOTAL', colX, totalsY);
        doc.text(`₹${order.totalPrice.toLocaleString()}`, valX, totalsY, { align: 'right', width: 82 });

        // --- PAYMENT & STATUS BOXES ---
        let infoY = totalsY + 50;
        if (order.isPaid) {
            doc.rect(40, infoY, 250, 40).fill('#ecfdf5');
            doc.strokeColor('#d1fae5').rect(40, infoY, 250, 40).stroke();
            doc.fillColor('#10b981').fontSize(7).font('Helvetica-Bold').text('PAYMENT CONFIRMED', 50, infoY + 10);
            const paidDate = new Date(order.paidAt);
            doc.fillColor('#047857').fontSize(9).text(`${paidDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} at ${paidDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, 50, infoY + 22);
            if (order.paymentResult?.id) {
                doc.fillColor('#10b981').fontSize(8).text(`TXN: ${order.paymentResult.id.slice(-12)}`, 200, infoY + 22, { align: 'right', width: 80 });
            }
            infoY += 55;
        }

        doc.rect(40, infoY, 250, 40).fill('#f9fafb');
        doc.strokeColor('#f1f1f4').rect(40, infoY, 250, 40).stroke();
        doc.fillColor('#a1a1aa').fontSize(7).font('Helvetica-Bold').text('ORDER STATUS', 50, infoY + 10);
        doc.fillColor('#27272a').fontSize(9).text(order.orderStatus.toUpperCase(), 50, infoY + 22);
        if (order.isDelivered && order.deliveredAt) {
            doc.fillColor('#a1a1aa').fontSize(8).text(`Delivered: ${new Date(order.deliveredAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, 150, infoY + 22, { align: 'right', width: 130 });
        }

        // --- FOOTER ---
        const footerY = 680;
        doc.strokeColor('#e4e4e7').moveTo(40, footerY).lineTo(572, footerY).stroke();
        
        doc.fillColor('#a1a1aa').fontSize(7).font('Helvetica-Bold').text('REGISTERED OFFICE', 40, footerY + 15);
        doc.fillColor('#52525b').fontSize(8).font('Helvetica-Bold').text('SLOOK FASHION PRIVATE LIMITED', 40, footerY + 27);
        doc.font('Helvetica').text('102, Premium Heights, Business District, Mumbai, Maharashtra - 400001', 40, footerY + 39);

        doc.fillColor('#a1a1aa').fontSize(7).font('Helvetica-Bold').text('AUTHORIZED SIGNATORY', 400, footerY + 15, { align: 'right', width: 172 });
        doc.strokeColor('#e4e4e7').moveTo(450, footerY + 50).lineTo(572, footerY + 50).stroke();
        doc.fillColor('#a1a1aa').font('Helvetica-Oblique').fontSize(8).text('SLOOK Digital Sign', 400, footerY + 40, { align: 'right', width: 172 });
        doc.fillColor('#a1a1aa').font('Helvetica-Bold').fontSize(7).text('FOR SLOOK FASHION PVT. LTD.', 400, footerY + 55, { align: 'right', width: 172 });

        doc.strokeColor('#e4e4e7').moveTo(40, footerY + 80).lineTo(572, footerY + 80).stroke();
        doc.fillColor('#a1a1aa').font('Helvetica').fontSize(7).text('support@slook.in • www.slook.in', 40, footerY + 90);
        doc.text('Computer Generated - No Signature Required', 400, footerY + 90, { align: 'right', width: 172 });

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
