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
        const { orderId, itemId, reason, comment, type, images, selectedVariant } = req.body;

        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ message: 'Order not found' });

        // Ensure Order is Delivered
        if (order.orderStatus !== 'Delivered') {
            return res.status(400).json({ message: 'Returns can only be requested for Delivered orders.' });
        }

        // Check 7-Day Return Window
        if (order.deliveredAt) {
            const deliveryDate = new Date(order.deliveredAt);
            const currentDate = new Date();
            const timeDiff = currentDate - deliveryDate;
            const daysDiff = timeDiff / (1000 * 60 * 60 * 24);

            if (daysDiff > 7) {
                return res.status(400).json({ message: 'Return period expired (7 days from delivery).' });
            }
        }

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

        /* 
           NOTE ON VIDEO PROOF: 
           User currently says "Proof can not upload". 
           The UI is missing, so we'll soften this check OR ensure UI is updated first.
           Implementation plan says: "Add Base64 proof upload UI".
           So let's keep the check but make sure to update UI immediately after.
        */
        const hasVideo = images && images.some(url =>
            url.match(/\.(mp4|mov|avi|mkv|webm)$/i) ||
            url.startsWith('data:video/')
        );
        const isDamaged = reason === 'Damaged Product' || reason === 'Wrong Item Received';

        if (isDamaged && !hasVideo) {
            return res.status(400).json({ message: 'Unboxing Video is REQUIRED for damaged/wrong items.' });
        }

        // Create Return Doc
        const newReturn = new Return({
            order: orderId,
            user: req.user._id,
            orderItem: {
                itemId: item._id,
                name: item.name,
                qty: item.qty,
                image: item.image,
                price: item.price,
                product: item.product,
                selectedVariant: item.selectedVariant || null // Safely handle null
            },
            type: type || 'Return',
            reason,
            comment,
            images: images || [],
            requestedVariant: selectedVariant || null, // Safely handle null
            status: 'Requested',
            timeline: [{ status: 'Requested', note: 'Return requested by user', user: req.user._id }]
        });

        const savedReturn = await newReturn.save();

        // Sync Order Status
        item.status = type === 'Exchange' ? 'Exchange Requested' : 'Return Requested';
        await order.save();

        // --- EMIT SOCKET EVENT ---
        const io = req.app.get('socketio');
        if (io) {
            io.emit('new-return', {
                _id: savedReturn._id,
                user: { firstName: req.user.firstName, lastName: req.user.lastName },
                type,
                reason
            });
        }

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
        const pageSize = Number(req.query.pageSize) || 20;
        const page = Number(req.query.page) || 1;
        const { keyword, status, type } = req.query;

        let query = {};

        if (keyword) {
            const isObjectId = keyword.match(/^[0-9a-fA-F]{24}$/);
            if (isObjectId) {
                query.$or = [{ _id: keyword }, { order: keyword }];
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
                query.user = { $in: userIds };
            }
        }

        if (status && status !== 'all' && status !== 'All') query.status = status;
        if (type && type !== 'all') query.type = type;

        const count = await Return.countDocuments(query);
        const returnsList = await Return.find(query)
            .populate('user', 'firstName lastName email')
            .populate('order', '_id createdAt')
            .sort({ createdAt: -1 })
            .limit(pageSize)
            .skip(pageSize * (page - 1));

        res.json({
            returns: returnsList,
            page,
            pages: Math.ceil(count / pageSize),
            total: count
        });
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
                type: 'press',
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
        const ret = await Return.findById(req.params.id).populate('user', 'email firstName');
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
                    if (ret.orderItem.selectedVariant && product.variants && product.variants.length > 0) {
                        const variant = product.variants.find(v =>
                            v.size === ret.orderItem.selectedVariant.size &&
                            v.color === ret.orderItem.selectedVariant.color
                        );
                        if (variant) {
                            variant.stock += ret.orderItem.qty;
                        } else {
                            product.countInStock += ret.orderItem.qty; // Fallback
                        }
                    } else {
                        product.countInStock += ret.orderItem.qty;
                    }
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
                    selectedVariant: ret.requestedVariant || ret.orderItem.selectedVariant, // Use requested if available
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

            // Stock Decrement for new item
            const product = await Product.findById(ret.orderItem.product);
            if (product) {
                const variantToUse = ret.requestedVariant || ret.orderItem.selectedVariant;
                const qtyToDeduct = ret.orderItem.qty || 1;

                if (variantToUse && product.variants && product.variants.length > 0) {
                    const variant = product.variants.find(v =>
                        v.size === variantToUse.size &&
                        (variantToUse.color ? v.color === variantToUse.color : true)
                    );
                    if (variant) {
                        variant.stock = Math.max(0, variant.stock - qtyToDeduct);
                    }
                }

                // Always decrement main stock for consistency
                product.countInStock = Math.max(0, product.countInStock - qtyToDeduct);
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
                type: 'press',
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

// @desc    Track Return Status (Public with Email verification)
// @route   GET /api/returns/track/:id?email=...
// @access  Public
const trackReturn = async (req, res) => {
    try {
        const { id } = req.params;
        const { email } = req.query;

        if (!email) return res.status(400).json({ message: 'Email is required for tracking' });

        const ret = await Return.findById(id)
            .populate('user', 'email')
            .select('status timeline orderItem type requestedVariant createdAt');

        if (!ret) return res.status(404).json({ message: 'Return request not found' });

        if (ret.user.email.toLowerCase() !== email.toLowerCase()) {
            return res.status(401).json({ message: 'Email does not match this return ID' });
        }

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
    resolveReturn,
    trackReturn
};
