const sendEmail = require('./utils/sendEmail');
require('dotenv').config();

const testMail = async () => {
    try {
        console.log('Starting test email...');
        await sendEmail({
            email: 'verify.slook@gmail.com', // Send to self
            subject: 'Test Campaign Email',
            html: '<h1>Success!</h1><p>This is a test to verify campaign sending functionality.</p>'
        });
        console.log('Test email sent successfully');
        process.exit(0);
    } catch (error) {
        console.error('Test email failed:', error);
        process.exit(1);
    }
};

testMail();
