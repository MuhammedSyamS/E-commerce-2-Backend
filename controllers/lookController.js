const fs = require('fs');
const path = require('path');
const { uploadToCloudinary, deleteFromCloudinary, extractPublicId } = require('../utils/cloudinary');

// @desc    Create a new look
// @route   POST /api/looks
// @access  Private
const createLook = async (req, res) => {
    try {
        const { caption, products } = req.body;

        if (!req.file) {
            return res.status(400).json({ message: 'Please upload an image' });
        }

        // Upload to Cloudinary
        const cloudinaryResult = await uploadToCloudinary(req.file.buffer, 'looks');

        const parsedProducts = JSON.parse(products);

        const look = new Look({
            user: req.user._id,
            userName: `${req.user.firstName} ${req.user.lastName}`.trim(),
            image: cloudinaryResult.secure_url,
            caption,
            products: parsedProducts,
            status: 'pending' // Requires admin approval before display
        });

        const createdLook = await look.save();
        res.status(201).json(createdLook);
    } catch (error) {
        console.error('Error creating look:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Get all approved looks
// @route   GET /api/looks
// @access  Public
const getAllLooks = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12; // Default to 12 looks
        const skip = (page - 1) * limit;

        const count = await Look.countDocuments({ status: 'approved' });
        
        const looks = await Look.find({ status: 'approved' })
            .populate('user', 'firstName lastName email avatar membershipTier')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        res.json({
            looks,
            page,
            pages: Math.ceil(count / limit),
            total: count
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Get user's own looks
// @route   GET /api/looks/my
// @access  Private
const getMyLooks = async (req, res) => {
    try {
        const looks = await Look.find({ user: req.user._id })
            .sort({ createdAt: -1 });
        res.json(looks);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Toggle like on a look
// @route   POST /api/looks/:id/like
// @access  Private
const toggleLike = async (req, res) => {
    try {
        const look = await Look.findById(req.params.id);
        if (!look) {
            return res.status(404).json({ message: 'Look not found' });
        }

        const isLiked = look.likes.includes(req.user._id);

        if (isLiked) {
            look.likes = look.likes.filter(id => id.toString() !== req.user._id.toString());
        } else {
            look.likes.push(req.user._id);
        }

        await look.save();
        res.json({ likes: look.likes });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Delete a look
// @route   DELETE /api/looks/:id
// @access  Private
const deleteLook = async (req, res) => {
    try {
        const look = await Look.findById(req.params.id);
        if (!look) {
            return res.status(404).json({ message: 'Look not found' });
        }

        // Check if user is owner or admin
        if (look.user.toString() !== req.user._id.toString() && !req.user.isAdmin) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        // --- CLOUDINARY CLEANUP ---
        const publicId = extractPublicId(look.image);
        if (publicId) {
            await deleteFromCloudinary(publicId).catch(err => console.error("Cloudinary Delete Error (Look):", err));
        }
        // -------------------------

        await Look.deleteOne({ _id: req.params.id });
        res.json({ message: 'Look removed' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Get all looks (Admin only)
// @route   GET /api/looks/admin
// @access  Private/Admin
const getAllLooksAdmin = async (req, res) => {
    try {
        const looks = await Look.find({})
            .populate('user', 'firstName lastName email avatar')
            .sort({ createdAt: -1 });
        res.json(looks);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Update look status
// @route   PATCH /api/looks/:id/status
// @access  Private/Admin
const updateLookStatus = async (req, res) => {
    try {
        const { status } = req.body;
        if (!['pending', 'approved', 'rejected'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        const look = await Look.findById(req.params.id);
        if (!look) {
            return res.status(404).json({ message: 'Look not found' });
        }

        look.status = status;
        await look.save();

        res.json(look);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Update a look (Admin edit caption)
// @route   PUT /api/looks/:id
// @access  Private/Admin
const updateLook = async (req, res) => {
    try {
        const { caption } = req.body;
        const look = await Look.findById(req.params.id);
        if (!look) {
            return res.status(404).json({ message: 'Look not found' });
        }

        if (caption !== undefined) look.caption = caption;
        const updated = await look.save();
        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

module.exports = {
    createLook,
    getAllLooks,
    getMyLooks,
    toggleLike,
    deleteLook,
    getAllLooksAdmin,
    updateLookStatus,
    updateLook
};

