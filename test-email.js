require('dotenv').config();
const nodemailer = require('nodemailer');

const sendTestEmail = async () => {
    console.log("--- STARTING EMAIL TEST ---");
    console.log(`User: ${process.env.EMAIL_USER}`);
    // Hide password for security in logs, just show length
    console.log(`Pass Length: ${process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : 0}`);

    const transporter = nodemailer.createTransport({
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

    try {
        console.log("Verifying connection...");
        await transporter.verify();
        console.log("Connection Verified!");

        console.log("Sending email...");
        const info = await transporter.sendMail({
            from: `"Test Script" <${process.env.EMAIL_USER}>`,
            to: process.env.EMAIL_USER, // Send to self
            subject: "SLOOK Email Test",
            text: "If you receive this, the email configuration is correct."
        });

        console.log("Email sent successfully!");
        console.log("Message ID:", info.messageId);
    } catch (error) {
        console.error("EMAIL TEST FAILED:");
        console.error(error);
    }
};

sendTestEmail();
