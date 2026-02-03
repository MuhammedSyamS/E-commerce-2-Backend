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
            // Prevent updating _id or timestamps manually if passed
            if (field !== '_id' && field !== 'createdAt' && field !== 'updatedAt') {
                settings[field] = req.body[field];
            }
        });

        const updatedSettings = await settings.save();
        res.json(updatedSettings);
    } catch (error) {
        res.status(500).json({ message: "Failed to update settings" });
    }
};
