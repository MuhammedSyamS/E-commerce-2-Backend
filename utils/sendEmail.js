const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    let transporter;

    // 1. Check if we have real credentials
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        // Assume Gmail if not specified, or use Host
        // Robust Gmail Configuration
        transporter = nodemailer.createTransport({
            service: 'gmail',
            host: 'smtp.gmail.com', // Explicit Host
            port: 587,              // Explicit Port
            secure: false,          // False for 587
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
            tls: {
                rejectUnauthorized: false // Fix for some local dev environments
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

        console.log('--- ETHEREAL EMAIL ---');
        console.log(`User: ${testAccount.user}`);
        console.log(`Pass: ${testAccount.pass}`);
        console.log('----------------------');
    }

    const mailOptions = {
        from: `"SLOOK Support" <${process.env.EMAIL_USER}>`,
        to: options.email,
        subject: options.subject,
        html: options.html,
        text: options.text
    };

    const info = await transporter.sendMail(mailOptions);

    console.log(`Message sent: ${info.messageId}`);

    // Log URL only if using Ethereal
    if (!process.env.EMAIL_USER && nodemailer.getTestMessageUrl(info)) {
        console.log(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    }

    return info;
};

module.exports = sendEmail;
