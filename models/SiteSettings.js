const mongoose = require('mongoose');

const siteSettingsSchema = new mongoose.Schema({
    siteName: { type: String, default: 'SLOOK STORE' },
    supportEmail: { type: String, default: 'support@slook.com' },
    maintenanceMode: { type: Boolean, default: false },

    // Policies (Rich Text or MarkDown)
    privacyPolicy: { type: String, default: '' },
    refundPolicy: { type: String, default: '' },
    termsOfService: { type: String, default: '' },

    // Configuration
    taxRate: { type: Number, default: 0 }, // Percentage
    shippingCharge: { type: Number, default: 0 },
    freeShippingThreshold: { type: Number, default: 0 },

    // Toggles
    orderAlerts: { type: Boolean, default: true },
    emailNotifications: { type: Boolean, default: true },
    marketingEmails: { type: Boolean, default: false },

    // Logistics
    minDeliveryDays: { type: Number, default: 3 },
    maxDeliveryDays: { type: Number, default: 7 },
    manifestLogo: { type: String, default: '' },

    // Global Scale (NEW Phase 11)
    defaultCurrency: { type: String, default: 'INR' },
    currencyRates: {
        type: Map,
        of: Number,
        default: {
            'USD': 0.012,
            'EUR': 0.011,
            'GBP': 0.0093,
            'INR': 1
        }
    }

}, { timestamps: true });

// Singleton pattern helper: always fetch the first document
siteSettingsSchema.statics.getSettings = async function () {
    const settings = await this.findOne();
    if (settings) return settings;
    return await this.create({});
};

module.exports = mongoose.model('SiteSettings', siteSettingsSchema);
