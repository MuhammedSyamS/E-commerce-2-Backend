/**
 * VAULT - Centralized & Validated Secret Management
 * Ensures no required environment variables are missing in production.
 */

const requiredVars = [
    'MONGO_URI',
    'JWT_SECRET',
    'EMAIL_USER',
    'EMAIL_PASS'
];

const optionalVars = [
    'RAZORPAY_KEY_ID',
    'RAZORPAY_KEY_SECRET',
    'CLIENT_URL',
    'SUPPORT_EMAIL',
    'PRESS_EMAIL',
    'VAPID_PUBLIC_KEY',
    'VAPID_PRIVATE_KEY',
    'ALLOWED_ORIGINS'
];

const vault = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: process.env.PORT || 5005,
    MONGO_URI: process.env.MONGO_URI,
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,

    // Email config
    EMAIL_USER: process.env.EMAIL_USER,
    EMAIL_PASS: process.env.EMAIL_PASS,
    SUPPORT_EMAIL: process.env.SUPPORT_EMAIL,
    SUPPORT_EMAIL_PASS: process.env.SUPPORT_EMAIL_PASS,
    PRESS_EMAIL: process.env.PRESS_EMAIL,
    PRESS_EMAIL_PASS: process.env.PRESS_EMAIL_PASS,

    // Client URL (CORS)
    CLIENT_URL: process.env.CLIENT_URL,
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,

    // Payment gateway
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,

    // Push Notifications
    VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,

    // Google Oauth
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,

    // Cloudinary
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET
};

// --- VALIDATION LOGIC ---
if (vault.NODE_ENV === 'production') {
    const missing = requiredVars.filter(v => !process.env[v]);

    if (missing.length > 0) {
        console.error('---------------------------------------------------------');
        console.error('🔥 CRITICAL SECURITY ERROR: MISSING PRODUCTION SECRETS');
        console.error('The following variables are required but not set:');
        missing.forEach(v => console.error(`   - ${v}`));
        console.error('---------------------------------------------------------');
        process.exit(1);
    }
}

module.exports = vault;
