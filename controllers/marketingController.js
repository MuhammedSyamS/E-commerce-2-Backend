const Coupon = require('../models/Coupon');
const Newsletter = require('../models/Newsletter');
const FlashSale = require('../models/FlashSale');
const Product = require('../models/Product');
const Order = require('../models/Order');

// --- COUPONS ---

// @desc    Verify Coupon
// @route   POST /api/marketing/verify-coupon
// @access  Public
exports.verifyCoupon = async (req, res) => {
    const { code, cartTotal, userId, cartItems } = req.body; // Added cartItems for detailed calculation
    try {
        const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });

        if (!coupon) {
            return res.status(404).json({ message: 'Invalid Coupon Code' });
        }

        if (new Date() > new Date(coupon.expiryDate)) {
            return res.status(400).json({ message: 'Coupon Expired' });
        }

        // 1. Global Usage Limit
        if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
            return res.status(400).json({ message: 'Coupon Usage Limit Reached' });
        }

        // 2. First Order Check
        if (coupon.isFirstOrderOnly) {
            if (!userId) return res.status(400).json({ message: 'Login required for this coupon' });
            const orderCount = await Order.countDocuments({ user: userId });
            if (orderCount > 0) return res.status(400).json({ message: 'Valid only for first-time orders' });
        }

        // 3. Per User Limit (If not first order only, check general user limit)
        if (coupon.perUserLimit && userId) {
            const userUsage = await Order.countDocuments({ user: userId, couponCode: coupon.code });
            if (userUsage >= coupon.perUserLimit) {
                return res.status(400).json({ message: 'You have already used this coupon' });
            }
        }

        // 4. Calculate Eligible Amount
        let eligibleAmount = cartTotal;

        // Filter by Product/Category if restrictions exist
        if ((coupon.eligibleProducts && coupon.eligibleProducts.length > 0) || (coupon.eligibleCategories && coupon.eligibleCategories.length > 0)) {
            if (!cartItems || cartItems.length === 0) {
                // Fallback if cartItems not sent (legacy support), assume valid or fail? 
                // Better to fail specific checks if data missing, or assume all valid if global.
                // For now, if restrictions exist but no items sent, we can't validate.
                if (!cartItems) return res.status(400).json({ message: 'Cart items required for validation' });
            }

            let eligibleItemsTotal = 0;
            let hasEligibleItem = false;

            cartItems.forEach(item => {
                const productId = item.product._id || item.product; // Handle populated or ID
                const category = item.category || item.product?.category; // Need consistent data

                const isProductEligible = coupon.eligibleProducts.length === 0 || coupon.eligibleProducts.map(id => id.toString()).includes(productId.toString());
                const isCategoryEligible = coupon.eligibleCategories.length === 0 || (category && coupon.eligibleCategories.includes(category));

                if (isProductEligible && isCategoryEligible) {
                    eligibleItemsTotal += (item.price * item.quantity);
                    hasEligibleItem = true;
                }
            });

            if (!hasEligibleItem) {
                return res.status(400).json({ message: 'Coupon not valid for items in cart' });
            }
            eligibleAmount = eligibleItemsTotal;
        }

        // 5. Min Purchase Check (on eligible amount? or total? Usually total cart value is used for threshold)
        if (eligibleAmount < coupon.minPurchase) {
            return res.status(400).json({ message: `Minimum purchase of ₹${coupon.minPurchase} required` });
        }


        let discount = 0;
        if (coupon.discountType === 'percentage') {
            discount = (eligibleAmount * coupon.discountAmount) / 100;
        } else {
            discount = coupon.discountAmount; // Fixed amount
            // For fixed, ensuring it doesn't exceed eligible amount is good practice
            if (discount > eligibleAmount) discount = eligibleAmount;
        }

        // Cap discount at total cart value just in case
        if (discount > cartTotal) discount = cartTotal;

        res.json({
            discount,
            code: coupon.code,
            message: 'Coupon Applied!'
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Coupon verification failed' });
    }
};

// @desc    Get All Coupons
// @route   GET /api/marketing/coupons
// @access  Private/Admin
exports.getCoupons = async (req, res) => {
    try {
        const coupons = await Coupon.find({}).sort({ createdAt: -1 });
        res.json(coupons);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch coupons' });
    }
};

// @desc    Create Coupon
// @route   POST /api/marketing/coupons
// @access  Private/Admin
exports.createCoupon = async (req, res) => {
    try {
        const {
            code,
            discountType,
            discountAmount,
            minPurchase,
            expiryDate,
            isFirstOrderOnly,
            eligibleProducts,
            eligibleCategories,
            usageLimit,
            perUserLimit
        } = req.body;

        const coupon = await Coupon.create({
            code,
            discountType,
            discountAmount,
            minPurchase,
            expiryDate,
            isFirstOrderOnly: isFirstOrderOnly || false,
            eligibleProducts: eligibleProducts || [],
            eligibleCategories: eligibleCategories || [],
            usageLimit: usageLimit || null,
            perUserLimit: perUserLimit || null
        });
        res.status(201).json(coupon);
    } catch (error) {
        console.error(error); // Added logging for better debug
        res.status(400).json({ message: 'Coupon creation failed' });
    }
};

// @desc    Delete Coupon
// @route   DELETE /api/marketing/coupons/:id
// @access  Private/Admin
exports.deleteCoupon = async (req, res) => {
    try {
        await Coupon.findByIdAndDelete(req.params.id);
        res.json({ message: 'Coupon deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Delete failed' });
    }
};

// --- NEWSLETTER ---

// @desc    Subscribe to Newsletter
// @route   POST /api/marketing/subscribe
// @access  Public
exports.subscribeNewsletter = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email || !email.includes('@')) {
            return res.status(400).json({ message: 'Invalid email address' });
        }

        const existing = await Newsletter.findOne({ email });
        if (existing) {
            if (!existing.isSubscribed) {
                existing.isSubscribed = true;
                await existing.save();
                return res.json({ message: 'Welcome back to the Inner Circle.' });
            }
            return res.json({ message: 'You are already on the list.' });
        }

        await Newsletter.create({ email });
        res.status(201).json({ message: 'Welcome to the Inner Circle.' });
    } catch (error) {
        res.status(500).json({ message: 'Subscription failed' });
    }
};

// --- FLASH SALES ---

// @desc    Get Active Flash Sale (Public)
// @route   GET /api/marketing/flash-sale
// @access  Public
exports.getActiveFlashSale = async (req, res) => {
    try {
        const now = new Date();
        // Find sale that has started and not ended
        const sale = await FlashSale.findOne({
            isActive: true,
            startTime: { $lte: now },
            endTime: { $gte: now }
        }).populate('products', 'name price image slug discountPrice isBestSeller');

        res.json(sale || null);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to fetch flash sale' });
    }
};

// @desc    Get All Flash Sales (Admin)
// @route   GET /api/marketing/flash-sales
// @access  Private/Admin
exports.getAllFlashSales = async (req, res) => {
    try {
        const sales = await FlashSale.find({}).sort({ startTime: -1 }).populate('products', 'name');
        res.json(sales);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch sales' });
    }
};

// @desc    Create Flash Sale
// @route   POST /api/marketing/flash-sales
// @access  Private/Admin
exports.createFlashSale = async (req, res) => {
    try {
        const { name, discountPercentage, startTime, endTime, products } = req.body;

        // Validation - Allow empty products for Global Sale
        if (!name || !discountPercentage || !startTime || !endTime) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const sale = await FlashSale.create({
            name,
            discountPercentage,
            startTime,
            endTime,
            products: products || [], // Empty means global
            isActive: true
        });

        res.status(201).json(sale);
    } catch (error) {
        console.error(error);
        res.status(400).json({ message: 'Flash sale creation failed' });
    }
};

// @desc    Delete Flash Sale
// @route   DELETE /api/marketing/flash-sales/:id
// @access  Private/Admin
exports.deleteFlashSale = async (req, res) => {
    try {
        await FlashSale.findByIdAndDelete(req.params.id);
        res.json({ message: 'Flash sale deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Delete failed' });
    }
};

// @desc    Check if product is in active flash sale
// @route   GET /api/marketing/check-flash/:productId
// @access  Public
exports.checkProductFlashSale = async (req, res) => {
    try {
        const now = new Date();
        const sales = await FlashSale.find({
            isActive: true,
            startTime: { $lte: now },
            endTime: { $gte: now }
        });

        // Find match: Either specific product match OR global sale (empty products)
        const sale = sales.find(s => s.products.length === 0 || s.products.includes(req.params.productId));

        if (sale) {
            res.json({
                active: true,
                discountPercentage: sale.discountPercentage,
                endTime: sale.endTime
            });
        } else {
            res.json({ active: false });
        }
    } catch (error) {
        res.status(500).json({ message: 'Check failed' });
    }
};
