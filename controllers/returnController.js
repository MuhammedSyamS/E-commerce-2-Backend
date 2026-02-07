const Return = require('../models/Return');
const Order = require('../models/Order');
const sendEmail = require('../utils/sendEmail');
const { getReturnStatusTemplate } = require('../utils/emailTemplates');
const Product = require('../models/Product');
const pushUtils = require('../utils/push');

// @desc    Create a Return Request
// @route   POST /api/returns
// @access  Private
const createReturnRequest = async (req, res) => {
    try {
        const { orderId, itemId, reason, comment, type, images } = req.body;

        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ message: 'Order not found' });

        // Verify Ownership
        if (order.user.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const item = order.orderItems.id(itemId);
        if (!item) return res.status(404).json({ message: 'Item not found' });

        // Check if Return already exists for this item
        const existingReturn = await Return.findOne({ order: orderId, 'orderItem.itemId': itemId });
        if (existingReturn) {
            return res.status(400).json({ message: 'Return request already exists for this item.' });
        }

        // Create Return Doc
        const newReturn = new Return({
            order: orderId,
            user: req.user._id,
            orderItem: {
                itemId: item._id, // Store linkage
                name: item.name,
                qty: item.qty,
                image: item.image,
                price: item.price,
                product: item.product,
                selectedVariant: item.selectedVariant
            },
            type: type || 'Return',
            reason,
            comment,
            images,
            status: 'Requested',
            timeline: [{ status: 'Requested', note: 'Return requested by user', user: req.user._id }]
        });

        const savedReturn = await newReturn.save();

        // Sync Order Status
        item.status = type === 'Exchange' ? 'Exchange Requested' : 'Return Requested';
        await order.save();

        res.status(201).json(savedReturn);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get All Returns (Admin)
// @route   GET /api/returns/admin
// @access  Private/Admin
const getAllReturns = async (req, res) => {
    try {
        const returns = await Return.find({})
            .populate('user', 'firstName lastName email')
            .populate('order', '_id createdAt')
            .sort({ createdAt: -1 });
        res.json(returns);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get My Returns (User)
// @route   GET /api/returns/my
// @access  Private
const getMyReturns = async (req, res) => {
    try {
        const returns = await Return.find({ user: req.user._id }).sort({ createdAt: -1 });
        res.json(returns);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Return by ID
// @route   GET /api/returns/:id
// @access  Private
const getReturnById = async (req, res) => {
    try {
        const ret = await Return.findById(req.params.id)
            .populate('user', 'firstName lastName email')
            .populate('order');
        if (ret) res.json(ret);
        else res.status(404).json({ message: 'Return not found' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update Return Status (Lifecycle Management)
// @route   PUT /api/returns/:id/status
// @access  Private/Admin
const updateReturnStatus = async (req, res) => {
    try {
        const { status, adminComment, pickupDetails, qcDetails } = req.body;
        // status: Approved, Rejected, Pickup Scheduled, Picked Up, Received, QC Passed, QC Failed

        const ret = await Return.findById(req.params.id);
        if (!ret) return res.status(404).json({ message: 'Return not found' });

        const previousStatus = ret.status;
        ret.status = status;
        if (adminComment) ret.adminComment = adminComment;

        // Timeline Entry
        ret.timeline.push({
            status,
            note: adminComment || `Status updated to ${status}`,
            user: req.user._id
        });

        // --- PHASE SPECIFIC UPDATES ---

        // 1. Logistics
        if (status === 'Pickup Scheduled' && pickupDetails) {
            ret.pickupDetails = { ...ret.pickupDetails, ...pickupDetails };
        }
        if (status === 'Picked Up') ret.pickupDetails.pickedUpAt = Date.now(); // Optional field if added to schema

        // 2. QC
        if (status === 'QC Passed' || status === 'QC Failed') {
            ret.qcDetails = {
                status: status === 'QC Passed' ? 'Passed' : 'Failed',
                adminComment: adminComment,
                checkedAt: Date.now(),
                checkedBy: req.user._id
            };
        }

        await ret.save();

        // --- SYNC WITH ORDER ---
        const order = await Order.findById(ret.order);
        if (order) {
            const item = order.orderItems.id(ret.orderItem.itemId);
            if (item) {
                // Map Return Status -> Order Item Status
                // Order Item Statuses: Return Requested, Returned, Exchange Requested, Exchanged, (+ Delivered if Rejected)

                if (status === 'Approved') {
                    // Do nothing or keep Requested? Or maybe have 'Return Approved' in Order? 
                    // Implementation Plan says: Order keeps simple status. 
                    // Let's keep it 'Return Requested' until finalized, OR update to 'Returned' only at end?
                    // User said: "Current status" implies real time.
                    // Schema has: 'Returned', 'Exchanged'.
                    // Let's map 'Received' -> 'Returned' (processed)? 
                    // Or maybe we need to expand Order status if we want full sync?
                    // For now, let's just handle terminal states or major shifts.
                }

                if (status === 'Rejected') {
                    item.status = 'Delivered'; // Revert
                }
                // Resolution is handled separately? Or here? 
                // Let's handle Resolution in a separate 'resolve' function for clarity, similar to previous controller.
            }
            await order.save();
        }

        // --- SEND EMAIL ---
        try {
            const fullReturn = await Return.findById(req.params.id).populate('user', 'email firstName');
            await sendEmail({
                email: fullReturn.user.email,
                subject: `Return Update: ${status}`,
                html: getReturnStatusTemplate(fullReturn, fullReturn.orderItem, status, adminComment)
            });
        } catch (emailErr) { console.error("Return Email Failed:", emailErr); }

        res.json(ret);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Resolve Return (Refund / Replacement)
// @route   PUT /api/returns/:id/resolve
// @access  Private/Admin
const resolveReturn = async (req, res) => {
    try {
        const ret = await Return.findById(req.params.id);
        if (!ret) return res.status(404).json({ message: 'Return not found' });

        if (ret.status !== 'QC Passed') return res.status(400).json({ message: 'QC must be passed before resolution' });

        const order = await Order.findById(ret.order);
        const item = order.orderItems.id(ret.orderItem.itemId);

        if (ret.type === 'Return') {
            // REFUND
            ret.status = 'Refund Completed';
            ret.resolutionDetails = {
                refundAmount: ret.orderItem.price * ret.orderItem.qty,
                resolvedAt: Date.now()
            };
            ret.timeline.push({ status: 'Refund Completed', note: 'Refund processed', user: req.user._id });

            // Sync Order
            if (item) item.status = 'Returned';

            // Re-stock Check
            if (ret.reason !== 'Damaged Product') {
                const product = await Product.findById(ret.orderItem.product);
                if (product) {
                    product.countInStock += ret.orderItem.qty;
                    // Variant logic...
                    await product.save();
                }
            }

        } else {
            // EXCHANGE
            // Create Replacement Order
            const replacementOrder = new Order({
                user: ret.user,
                orderItems: [{
                    name: `REPLACEMENT: ${ret.orderItem.name}`,
                    qty: ret.orderItem.qty,
                    image: ret.orderItem.image,
                    price: 0,
                    product: ret.orderItem.product,
                    selectedVariant: ret.orderItem.selectedVariant,
                    status: 'Processing'
                }],
                shippingAddress: order.shippingAddress,
                paymentMethod: 'Exchange Replacement',
                totalPrice: 0,
                isPaid: true,
                orderStatus: 'Processing'
            });
            const createdReplacement = await replacementOrder.save();

            ret.status = 'Replacement Sent'; // Or 'Exchanged'
            ret.resolutionDetails = {
                replacementOrderId: createdReplacement._id,
                resolvedAt: Date.now()
            };
            ret.timeline.push({ status: 'Replacement Sent', note: `Replacement Order #${createdReplacement._id}`, user: req.user._id });

            // Sync Order
            if (item) item.status = 'Exchanged';

            // Stock Decrement for new item (Assuming same item for now)
            const product = await Product.findById(ret.orderItem.product);
            if (product) {
                product.countInStock -= ret.orderItem.qty;
                await product.save();
            }
        }

        await ret.save();
        await order.save();

        // --- SEND EMAIL RESOLUTION ---
        try {
            const resolutionStatus = ret.type === 'Return' ? 'Refund Completed' : 'Replacement Sent';
            const subject = ret.type === 'Return' ? 'Refund Processed' : 'Replacement Order Created';

            await sendEmail({
                email: ret.user.email,
                subject: `${subject} - ${ret.orderItem.name}`,
                html: getReturnStatusTemplate(ret, ret.orderItem, resolutionStatus, `Resolution Completed. ${ret.type === 'Exchange' ? 'Check your orders for replacement.' : 'Refund initiated.'}`)
            });
        } catch (e) { console.error("Resolve Email Failed:", e); }

        res.json(ret);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createReturnRequest,
    getAllReturns,
    getMyReturns,
    getReturnById,
    updateReturnStatus,
    resolveReturn
};
