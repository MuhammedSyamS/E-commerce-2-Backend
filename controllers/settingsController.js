const SiteSettings = require('../models/SiteSettings');

// @desc    Get Site Settings (Public/Admin)
// @route   GET /api/settings
// @access  Public
exports.getSettings = async (req, res) => {
    try {
        const settings = await SiteSettings.getSettings();
        res.json(settings);
    } catch (error) {
        res.status(500).json({ message: "Failed to load settings" });
    }
};

// @desc    Update Site Settings
// @route   PUT /api/settings
// @access  Private/Admin
exports.updateSettings = async (req, res) => {
    try {
        let settings = await SiteSettings.findOne(); // Not using singleton helper directly to keep it simple for update
        if (!settings) {
            settings = new SiteSettings();
        }

        // Update fields
        const fields = Object.keys(req.body);
        fields.forEach(field => {
            if (field !== '_id' && field !== 'createdAt' && field !== 'updatedAt') {
                if (field === 'heroSlides' && Array.isArray(req.body.heroSlides)) {
                    // Filter out slides without an image to prevent validation errors
                    settings.heroSlides = req.body.heroSlides.filter(slide => slide.img && slide.img.trim() !== '');
                } else if (field === 'topNavbarMessages' && Array.isArray(req.body.topNavbarMessages)) {
                    settings.topNavbarMessages = req.body.topNavbarMessages.filter(msg => msg.text && msg.text.trim() !== '');
                } else {
                    settings[field] = req.body[field];
                }
            }
        });

        if (req.body.heroSlides) {
            settings.markModified('heroSlides');
        }
        if (req.body.topNavbarMessages) {
            settings.markModified('topNavbarMessages');
        }

        const updatedSettings = await settings.save();
        res.json(updatedSettings);
    } catch (error) {
        console.error("Settings Update Error:", error);
        res.status(500).json({ message: "Failed to update settings" });
    }
};
