const mongoose = require('mongoose');
const {
    toggleCouponStatus,
    toggleFlashSaleStatus,
    createBroadcast
} = require('./controllers/marketingController');
const Coupon = require('./models/Coupon');
const FlashSale = require('./models/FlashSale');
require('dotenv').config();

const verifyPro = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const mockRes = () => ({
            status: function (code) { this.statusCode = code; return this; },
            json: function (data) { this.data = data; return this; }
        });

        // 1. TEST COUPON TOGGLE
        console.log('\n--- Testing Coupon Toggle ---');
        const coupon = await Coupon.findOne({});
        if (coupon) {
            const initialStatus = coupon.isActive;
            const toggleReq = { params: { id: coupon._id } };
            const toggleRes = mockRes();
            await toggleCouponStatus(toggleReq, toggleRes);
            console.log('Toggle Status Result:', toggleRes.data.isActive);
            if (toggleRes.data.isActive !== initialStatus) {
                console.log('Coupon toggle successful.');
            }
        }

        // 2. TEST FLASH SALE TOGGLE
        console.log('\n--- Testing Flash Sale Toggle ---');
        const sale = await FlashSale.findOne({});
        if (sale) {
            const initialStatus = sale.isActive;
            const toggleReq = { params: { id: sale._id } };
            const toggleRes = mockRes();
            await toggleFlashSaleStatus(toggleReq, toggleRes);
            console.log('Toggle Status Result:', toggleRes.data.isActive);
            if (toggleRes.data.isActive !== initialStatus) {
                console.log('Flash sale toggle successful.');
            }
        }

        // 3. TEST BROADCAST DRAFT
        console.log('\n--- Testing Broadcast Draft ---');
        const draftReq = {
            body: {
                subject: 'Draft Test',
                content: '<p>Draft</p>',
                targetAudience: 'Subscribers',
                status: 'Draft'
            }
        };
        const draftRes = mockRes();
        await createBroadcast(draftReq, draftRes);
        console.log('Draft Status Result:', draftRes.data.status);
        if (draftRes.data.status === 'Draft' && draftRes.data.sentCount === 0) {
            console.log('Broadcast draft successful.');
        }

        console.log('\nPro Suite Verification Complete.');
        process.exit(0);
    } catch (error) {
        console.error('Verification failed:', error);
        process.exit(1);
    }
};

verifyPro();
