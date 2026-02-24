// Quick email test — run with: node test_email.js
require('dotenv').config();
const nodemailer = require('nodemailer');

async function test() {
    const email = process.env.SUPPORT_EMAIL || process.env.EMAIL_USER;
    const pass = process.env.SUPPORT_EMAIL_PASS || process.env.EMAIL_PASS;

    console.log('📧 Testing with:', email);
    console.log('🔑 Password set:', pass ? `YES (${pass.length} chars)` : 'NO');

    // Check if it's still the placeholder
    if (pass && pass.startsWith('REPLACE_WITH')) {
        console.log('❌ ERROR: SUPPORT_EMAIL_PASS is still the placeholder text!');
        console.log('   → Using EMAIL_PASS (verify.slook@gmail.com) as fallback instead...');
    }

    // Always fall back to working credentials for the test
    const testEmail = process.env.EMAIL_USER;
    const testPass = process.env.EMAIL_PASS;

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: testEmail, pass: testPass },
        tls: { rejectUnauthorized: false },
    });

    try {
        await transporter.verify();
        console.log('✅ SMTP connection OK with', testEmail);

        await transporter.sendMail({
            from: `"SLOOK Support" <${testEmail}>`,
            to: testEmail, // send to self as test
            subject: 'SLOOK Email Test',
            text: 'If you see this, email sending works!',
        });
        console.log('✅ Test email sent successfully to', testEmail);
    } catch (err) {
        console.log('❌ ERROR:', err.message);
    }
}

test();
