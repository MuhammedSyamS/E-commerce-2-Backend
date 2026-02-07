const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    let transporter;

    // 1. Check if we have real credentials
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        // Assume Gmail if not specified, or use Host
        const config = {
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        };

        if (process.env.EMAIL_HOST) {
            config.host = process.env.EMAIL_HOST;
            config.port = process.env.EMAIL_PORT || 587;
        } else {
            // Default to Gmail service if using gmail address, or just standard smtp
            config.service = 'gmail';
        }

        transporter = nodemailer.createTransport(config);
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
        from: `HighPhaus <${process.env.EMAIL_USER || 'admin@highphaus.com'}>`,
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
