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
    isReferralEnabled: { type: Boolean, default: true },

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
    },

    // Hero Section (NEW Phase 12)
    heroSlides: [{
        img: { type: String, required: true },
        title: { type: String, default: '' },
        subtitle: { type: String, default: '' },
        link: { type: String, default: '' }
    }],

    // Top Navbar Section
    topNavbarMessages: [{
        text: { type: String, required: true },
        link: { type: String, default: '' }
    }],

    // Slook Coins Settings
    loyaltyPointsEnabled: { type: Boolean, default: true },
    maxCoinsPerOrder: { type: Number, default: 100 },
    maxCoinsPercentage: { type: Number, default: 30 }, // 30%
    minCoinsToRedeem: { type: Number, default: 100 },
    
    // Earning Rates (Coins per ₹1000 spent)
    earnRateOnline: { type: Number, default: 4 }, // 1 coin per ₹250 = 4 coins per ₹1000
    earnRateCOD: { type: Number, default: 2 },    // 1 coin per ₹500 = 2 coins per ₹1000
    
    // Tier Multipliers
    silverMultiplier: { type: Number, default: 1 },
    goldMultiplier: { type: Number, default: 1.5 },
    platinumMultiplier: { type: Number, default: 2 },

    // Tier Thresholds (Total Spent)
    silverThreshold: { type: Number, default: 10000 },
    goldThreshold: { type: Number, default: 50000 },
    platinumThreshold: { type: Number, default: 100000 },
}, { timestamps: true });

// Singleton pattern helper: always fetch the first document
siteSettingsSchema.statics.getSettings = async function () {
    const settings = await this.findOne();
    if (settings) return settings;
    return await this.create({});
};

module.exports = mongoose.model('SiteSettings', siteSettingsSchema);
