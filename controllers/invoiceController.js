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

        const doc = new PDFDocument({ margin: 40, size: 'A4' });

        // Stream the PDF to the response
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice_${order._id}.pdf`);
        doc.pipe(res);

        const invoiceNo = `SLK-${order._id.toString().slice(-8).toUpperCase()}`;

        // --- THEME COLORS ---
        const BLACK = '#000000';
        const ZINC_900 = '#18181b';
        const ZINC_500 = '#71717a';
        const ZINC_400 = '#a1a1aa';
        const ZINC_100 = '#f4f4f5';
        const ACCENT = '#f59e0b'; // Amber-500

        // --- HEADER SECTION ---
        doc.fillColor(BLACK)
           .fontSize(28)
           .font('Helvetica-Bold')
           .text('SLOOK', 40, 40, { characterSpacing: -1 });
           
        doc.fontSize(8)
           .font('Helvetica')
           .fillColor(ZINC_500)
           .text('PREMIUM CURATED FASHION STUDIO', 42, 70, { characterSpacing: 2 });

        // --- INVOICE TOP DETAILS ---
        doc.fillColor(BLACK).fontSize(10).font('Helvetica-Bold').text('TAX INVOICE', 400, 40, { align: 'right' });
        doc.fillColor(ZINC_500).fontSize(8).font('Helvetica').text('INV NO:', 400, 55, { align: 'right', continued: true });
        doc.fillColor(BLACK).font('Helvetica-Bold').text(` #${invoiceNo}`);
        doc.fillColor(ZINC_500).font('Helvetica').text('DATE:', 400, 68, { align: 'right', continued: true });
        doc.fillColor(BLACK).font('Helvetica-Bold').text(` ${new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`);

        doc.moveTo(40, 95).lineTo(555, 95).strokeColor(ZINC_100).lineWidth(1).stroke();

        // --- ACCOUNTING & TAX DATA (Improved PAN/GST) ---
        const taxY = 110;
        doc.rect(40, taxY, 515, 45).fill(ZINC_100);
        
        doc.fillColor(ZINC_500).fontSize(7).font('Helvetica-Bold').text('SELLER COMPLIANCE DATA', 55, taxY + 10);
        
        doc.fillColor(BLACK).fontSize(9).font('Helvetica-Bold').text('GSTIN:', 55, taxY + 22);
        doc.font('Helvetica').text('27AAAAA0000A1Z5', 95, taxY + 22);
        
        doc.font('Helvetica-Bold').text('PAN:', 220, taxY + 22);
        doc.font('Helvetica').text('AAAAA0000A', 250, taxY + 22);
        
        doc.font('Helvetica-Bold').text('PLACE:', 360, taxY + 22);
        doc.font('Helvetica').text(order.shippingAddress.city.toUpperCase(), 400, taxY + 22);

        doc.font('Helvetica-Bold').text('REV CHG:', 480, taxY + 22);
        doc.font('Helvetica').text('NO', 530, taxY + 22);

        // --- ADDRESS SECTION ---
        const addrY = 180;
        doc.fillColor(ZINC_400).fontSize(7).font('Helvetica-Bold').text('BILLING DETAILS', 40, addrY);
        doc.fillColor(BLACK).fontSize(11).font('Helvetica-Bold').text(`${order.user.firstName} ${order.user.lastName}`, 40, addrY + 15);
        doc.fillColor(ZINC_500).fontSize(9).font('Helvetica').text(order.user.email, 40, addrY + 30);
        if (order.user.phone) doc.text(`Ph: ${order.user.phone}`, 40, addrY + 43);

        doc.fillColor(ZINC_400).fontSize(7).font('Helvetica-Bold').text('SHIPPING ADDRESS', 340, addrY, { align: 'right', width: 215 });
        doc.fillColor(BLACK).fontSize(10).font('Helvetica-Bold').text(order.shippingAddress.address, 340, addrY + 15, { align: 'right', width: 215 });
        doc.fillColor(ZINC_500).fontSize(9).font('Helvetica').text(`${order.shippingAddress.city}, ${order.shippingAddress.postalCode}`, 340, addrY + 32, { align: 'right', width: 215 });
        doc.text(`Contact: ${order.shippingAddress.phone}`, 340, addrY + 45, { align: 'right', width: 215 });

        // --- TABLE HEADER ---
        const tableTop = 265;
        doc.rect(40, tableTop, 515, 25).fill(BLACK);
        
        doc.fillColor('#ffffff').fontSize(7).font('Helvetica-Bold')
           .text('ITEM DESCRIPTION', 55, tableTop + 9)
           .text('QTY', 360, tableTop + 9, { width: 40, align: 'center' })
           .text('UNIT PRICE', 410, tableTop + 9, { width: 60, align: 'right' })
           .text('TOTAL', 485, tableTop + 9, { width: 60, align: 'right' });

        // --- ITEMS ---
        let currentY = tableTop + 35;
        order.orderItems.forEach((item, index) => {
            // Background for alternating rows
            if (index % 2 !== 0) {
                doc.rect(40, currentY - 5, 515, 25).fill('#fafafa');
            }

            doc.fillColor(BLACK).fontSize(9).font('Helvetica-Bold').text(item.name, 55, currentY);
            if (item.selectedVariant) {
                const variantText = `${item.selectedVariant.size ? `Size: ${item.selectedVariant.size}` : ''}${item.selectedVariant.size && item.selectedVariant.color ? ' | ' : ''}${item.selectedVariant.color ? `Color: ${item.selectedVariant.color}` : ''}`;
                doc.fillColor(ZINC_500).font('Helvetica').fontSize(7).text(variantText, 55, currentY + 10);
            }

            doc.fillColor(BLACK).fontSize(9).font('Helvetica').text(item.qty.toString(), 360, currentY, { width: 40, align: 'center' });
            doc.text(`₹${item.price.toLocaleString()}`, 410, currentY, { width: 60, align: 'right' });
            doc.font('Helvetica-Bold').text(`₹${(item.qty * item.price).toLocaleString()}`, 485, currentY, { width: 60, align: 'right' });

            currentY += item.selectedVariant ? 30 : 25;
        });

        // --- TOTALS ---
        const subtotal = order.orderItems.reduce((acc, item) => acc + (item.qty * item.price), 0);
        let totalsY = Math.max(currentY + 20, 600);
        const colWidth = 120;
        const startX = 555 - colWidth;

        const drawTotalRow = (label, val, isFinal = false) => {
            doc.fillColor(isFinal ? BLACK : ZINC_500)
               .fontSize(isFinal ? 10 : 8)
               .font(isFinal ? 'Helvetica-Bold' : 'Helvetica')
               .text(label, startX - 50, totalsY);
            
            const displayVal = (label.includes('Shipping') && val === 0) ? 'FREE' : `₹${val.toLocaleString()}`;
            doc.text(displayVal, startX, totalsY, { align: 'right', width: colWidth });
            
            if (isFinal) {
                doc.moveTo(startX - 50, totalsY - 5).lineTo(555, totalsY - 5).strokeColor(BLACK).lineWidth(1.5).stroke();
            }
            totalsY += 18;
        };

        drawTotalRow('Subtotal', subtotal);
        if (order.discountAmount > 0) drawTotalRow('Promo Discount', -order.discountAmount);
        if (order.loyaltyDiscount > 0) drawTotalRow('Loyalty Credit', -order.loyaltyDiscount);
        drawTotalRow('Shipping Fee', order.shippingPrice || 0);
        drawTotalRow('GST (Inclusive)', order.taxPrice || 0);
        totalsY += 10;
        drawTotalRow('GRAND TOTAL', order.totalPrice, true);

        // --- PAYMENT STATUS STAMP ---
        const stampY = 720;
        if (order.isPaid) {
            doc.rect(40, stampY, 140, 45).fill('#f0fdf4');
            doc.fillColor('#16a34a').fontSize(8).font('Helvetica-Bold').text('PAYMENT VERIFIED', 50, stampY + 12);
            doc.fontSize(7).font('Helvetica').text(new Date(order.paidAt).toLocaleDateString() + ' ' + new Date(order.paidAt).toLocaleTimeString(), 50, stampY + 25);
        } else {
            doc.rect(40, stampY, 140, 45).fill('#fffbeb');
            doc.fillColor('#d97706').fontSize(8).font('Helvetica-Bold').text('PAYMENT PENDING', 50, stampY + 12);
            doc.fontSize(7).font('Helvetica').text('Awaiting realization', 50, stampY + 25);
        }

        // --- FOOTER ---
        doc.moveTo(40, 780).lineTo(555, 780).strokeColor(ZINC_100).lineWidth(1).stroke();
        doc.fillColor(ZINC_400).fontSize(7).font('Helvetica')
           .text('SLOOK FASHION PRIVATE LIMITED • support@slook.in • www.slook.in', 40, 790);
        doc.text('This is a computer-generated document. No signature required.', 40, 802);

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

// @desc    Generate Admin Audit Report (Revenue Summary)
// @route   GET /api/orders/admin/report
// @access  Private/Admin
exports.generateAdminReport = async (req, res) => {
    try {
        const orders = await Order.find({ isPaid: true }).populate('user', 'firstName lastName email').sort({ createdAt: -1 }).limit(50);
        
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=admin_audit_report.pdf');
        doc.pipe(res);

        // --- HEADER ---
        doc.fillColor('#000000').fontSize(24).font('Helvetica-Bold').text('TREASURY AUDIT REPORT', 40, 40);
        doc.fontSize(8).font('Helvetica').fillColor('#71717a').text('SLOOK FINANCIAL RECONCILIATION • GENERATED ON ' + new Date().toLocaleString(), 40, 70);

        // --- STATS OVERVIEW ---
        const totalRevenue = orders.reduce((acc, o) => acc + o.totalPrice, 0);
        doc.rect(40, 90, 515, 60).fill('#f8fafc');
        doc.fillColor('#64748b').fontSize(8).font('Helvetica-Bold').text('AGGREGATE REVENUE (LAST 50 TRANS)', 60, 105);
        doc.fillColor('#0f172a').fontSize(22).text(`₹${totalRevenue.toLocaleString()}`, 60, 120);

        // --- TABLE ---
        const tableTop = 170;
        doc.rect(40, tableTop, 515, 20).fill('#000000');
        doc.fillColor('#ffffff').fontSize(7).font('Helvetica-Bold')
           .text('TRANS ID', 50, tableTop + 7)
           .text('ENTITY', 150, tableTop + 7)
           .text('METHOD', 300, tableTop + 7)
           .text('DATE', 400, tableTop + 7)
           .text('VALUATION', 480, tableTop + 7, { align: 'right', width: 65 });

        let y = tableTop + 30;
        orders.forEach((o, i) => {
            if (y > 750) {
                doc.addPage();
                y = 50;
            }
            if (i % 2 !== 0) doc.rect(40, y - 5, 515, 20).fill('#f1f5f9');
            
            doc.fillColor('#0f172a').fontSize(8).font('Helvetica').text(o._id.toString().slice(-10), 50, y);
            doc.text(`${o.user?.firstName || 'Guest'}`, 150, y);
            doc.text(o.paymentMethod.toUpperCase(), 300, y);
            doc.text(new Date(o.createdAt).toLocaleDateString(), 400, y);
            doc.font('Helvetica-Bold').text(`₹${o.totalPrice.toLocaleString()}`, 480, y, { align: 'right', width: 65 });
            
            y += 20;
        });

        doc.end();
    } catch (error) {
        console.error("REPORT ERROR:", error);
        res.status(500).json({ message: "Failed to generate audit report" });
    }
};

