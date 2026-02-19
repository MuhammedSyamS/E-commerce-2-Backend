const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const sendEmail = async (options) => {
    const logFile = path.join(__dirname, '../debug_otp.log');
    const log = (msg) => {
        const timestamp = new Date().toISOString();
        const logMsg = `[${timestamp}] ${msg}\n`;
        fs.appendFileSync(logFile, logMsg);
        console.log(msg);
    };

    let transporter;

    log(`--- SENDING EMAIL TO: ${options.email} ---`);
    log(`Subject: ${options.subject}`);

    try {
        // 1. Check if we have real credentials
        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            transporter = nodemailer.createTransport({
                service: 'gmail',
                host: 'smtp.gmail.com',
                port: 587,
                secure: false,
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                },
                tls: {
                    rejectUnauthorized: false
                }
            });
        } else {
            // 2. Fallback to Ethereal (Dev Mode)
            const testAccount = await nodemailer.createTestAccount();
            transporter = nodemailer.createTransport({
                host: 'smtp.ethereal.email',
                port: 587,
                secure: false,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass
                }
            });

            log('Using Ethereal Fallback');
        }

        const mailOptions = {
            from: `"SLOOK Support" <${process.env.EMAIL_USER || 'support@slook.com'}>`,
            to: options.email,
            subject: options.subject,
            html: options.html,
            text: options.text
        };

        const info = await transporter.sendMail(mailOptions);
        log(`Message sent successfully: ${info.messageId}`);

        if (!process.env.EMAIL_USER && nodemailer.getTestMessageUrl(info)) {
            log(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
        }

        return info;
    } catch (error) {
        log(`EMAIL ERROR: ${error.message}`);
        throw error;
    }
};

module.exports = sendEmail;
