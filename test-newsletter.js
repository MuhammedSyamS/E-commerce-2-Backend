const sendEmail = require('./utils/sendEmail');
const { getNewsletterWelcomeTemplate } = require('./utils/emailTemplates');
require('dotenv').config();

const test = async () => {
    try {
        console.log("Testing email...");
        await sendEmail({
            email: "test@example.com",
            subject: "Test",
            html: getNewsletterWelcomeTemplate("test@example.com")
        });
        console.log("Test pass");
    } catch (err) {
        console.error("Test fail:", err);
    }
}

test();
