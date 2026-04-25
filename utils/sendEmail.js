const nodemailer = require('nodemailer');
const logger = require('./logger');

/**
 * Unified email sender with account routing:
 *  - type: 'press'  → press.slook@gmail.com  → "SLOOK Press"   (orders, shipping, newsletter, returns)
 *  - default        → verify.slook@gmail.com → "SLOOK Verification" (OTP, auth emails)
 *
 * PERFORMANCE: Transporters are created ONCE at startup (not per-request).
 * Connection pooling is enabled to reuse SMTP connections.
 */

// --- Build transporters ONCE at startup (not per-request) ---
let verificationTransporter = null;
let pressTransporter = null;

function createTransporter(user, pass) {
    if (!user || !pass) return null;
    return nodemailer.createTransport({
        service: 'gmail',
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        pool: true,           // Reuse connections — eliminates per-send handshake delay
        maxConnections: 5,
        maxMessages: 100,
        auth: { user, pass },
        tls: { rejectUnauthorized: false }
    });
}

// Initialize at module load time
const emailUser = process.env.EMAIL_USER;
const emailPass = process.env.EMAIL_PASS;
const pressEmail = process.env.PRESS_EMAIL;
const pressPass = process.env.PRESS_EMAIL_PASS;

// Check for placeholder passwords
const pressReady = pressPass && !pressPass.startsWith('REPLACE_WITH');

verificationTransporter = createTransporter(emailUser, emailPass);
pressTransporter = pressReady
    ? createTransporter(pressEmail || emailUser, pressPass)
    : verificationTransporter;

// Fallback: Use Ethereal for dev if no credentials
let etherealTransporter = null;
async function getEtherealTransporter() {
    if (etherealTransporter) return etherealTransporter;
    const testAccount = await nodemailer.createTestAccount();
    etherealTransporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        pool: true,
        auth: { user: testAccount.user, pass: testAccount.pass }
    });
    return etherealTransporter;
}

/**
 * Send an email.
 * @param {object} options - { email, subject, html, text, type? }
 */
const sendEmail = async (options) => {
    const isPress = options.type === 'press';

    let transporter = isPress ? pressTransporter : verificationTransporter;
    let senderEmail = isPress ? (pressReady ? (pressEmail || emailUser) : emailUser) : emailUser;
    let senderName = isPress ? 'SLOOK Press' : 'SLOOK Verification';

    // Dev fallback to Ethereal
    if (!transporter) {
        logger.warn('[MAIL] No credentials configured — using Ethereal fallback');
        transporter = await getEtherealTransporter();
        senderEmail = 'support@slook.com';
    }

    const mailOptions = {
        from: `"${senderName}" <${senderEmail}>`,
        to: options.email,
        subject: options.subject,
        html: options.html,
        text: options.text
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        logger.info(`[MAIL] Sent to ${options.email} | ID: ${info.messageId}`);
        return info;
    } catch (error) {
        logger.error(`[MAIL] Failed for ${options.email}: ${error.message}`);
        throw error;
    }
};

module.exports = sendEmail;
