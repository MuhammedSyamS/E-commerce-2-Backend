const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

/**
 * Unified email sender with account routing:
 *  - type: 'press'  → press.slook@gmail.com  → "SLOOK Press"   (orders, shipping, newsletter, returns)
 *  - default        → verify.slook@gmail.com → "SLOOK Verification" (OTP, auth emails)
 */
const sendEmail = async (options) => {
    const logFile = path.join(__dirname, '../debug_otp.log');
    const log = (msg) => {
        const timestamp = new Date().toISOString();
        fs.appendFileSync(logFile, `[${timestamp}] ${msg}\n`);
        console.log(msg);
    };

    log(`--- SENDING EMAIL TO: ${options.email} [type: ${options.type || 'verification'}] ---`);
    log(`Subject: ${options.subject}`);

    // Pick credentials and display name based on type
    const isPress = options.type === 'press';

    // Detect placeholder passwords — fall back to verified EMAIL_USER credentials
    const pressPass = process.env.PRESS_EMAIL_PASS;
    const pressReady = pressPass && !pressPass.startsWith('REPLACE_WITH');

    const senderEmail = isPress
        ? (pressReady ? (process.env.PRESS_EMAIL || process.env.EMAIL_USER) : process.env.EMAIL_USER)
        : process.env.EMAIL_USER;

    const senderPass = isPress
        ? (pressReady ? pressPass : process.env.EMAIL_PASS)
        : process.env.EMAIL_PASS;

    const senderName = isPress ? 'SLOOK Press' : 'SLOOK Verification';

    let transporter;

    try {
        if (senderEmail && senderPass) {
            log(`[MAIL] Attempting to send ${options.type || 'verification'} email to: ${options.email} using ${senderEmail}`);
            transporter = nodemailer.createTransport({
                service: 'gmail',
                host: 'smtp.gmail.com',
                port: 587,
                secure: false,
                auth: { user: senderEmail, pass: senderPass },
                tls: { rejectUnauthorized: false }
            });
            log(`[MAIL] Transporter created for ${senderEmail}`);
        } else {
            // Fallback to Ethereal (Dev Mode)
            const testAccount = await nodemailer.createTestAccount();
            transporter = nodemailer.createTransport({
                host: 'smtp.ethereal.email',
                port: 587,
                secure: false,
                auth: { user: testAccount.user, pass: testAccount.pass }
            });
            log('Using Ethereal Fallback');
        }

        const mailOptions = {
            from: `"${senderName}" <${senderEmail || 'support@slook.com'}>`,
            to: options.email,
            subject: options.subject,
            html: options.html,
            text: options.text
        };

        const info = await transporter.sendMail(mailOptions);
        log(`Message sent: ${info.messageId} via ${senderEmail}`);

        if (!senderEmail && nodemailer.getTestMessageUrl(info)) {
            log(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
        }

        return info;
    } catch (error) {
        log(`EMAIL ERROR: ${error.message}`);
        throw error;
    }
};

module.exports = sendEmail;
