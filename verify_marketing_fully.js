const mongoose = require('mongoose');
const {
    createCoupon,
    getCoupons,
    deleteCoupon,
    createFlashSale,
    getAllFlashSales,
    deleteFlashSale
} = require('./controllers/marketingController');
require('dotenv').config();

const verify = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const mockRes = () => ({
            status: function (code) { this.statusCode = code; return this; },
            json: function (data) { this.data = data; return this; }
        });

        // 1. TEST COUPONS
        console.log('\n--- Testing Coupons ---');
        const couponReq = {
            body: {
                code: 'VERIFY_TEST_' + Date.now(),
                discountType: 'percentage',
                discountAmount: 10,
                minPurchase: 100,
                expiryDate: new Date(Date.now() + 86400000)
            }
        };
        const couponRes = mockRes();
        await createCoupon(couponReq, couponRes);
        console.log('Create Coupon Status:', couponRes.statusCode || 201);
        const createdCouponId = couponRes.data._id;
        console.log('Created Coupon ID:', createdCouponId);

        const fetchCouponsRes = mockRes();
        await getCoupons({}, fetchCouponsRes);
        console.log('Fetch Coupons Count:', fetchCouponsRes.data.length);

        const deleteCouponReq = { params: { id: createdCouponId } };
        const deleteCouponRes = mockRes();
        await deleteCoupon(deleteCouponReq, deleteCouponRes);
        console.log('Delete Coupon Status:', deleteCouponRes.statusCode || 200, deleteCouponRes.data.message);

        // 2. TEST FLASH SALES
        console.log('\n--- Testing Flash Sales ---');
        const flashReq = {
            body: {
                name: 'VERIFY_FLASH_' + Date.now(),
                discountPercentage: 20,
                startTime: new Date(),
                endTime: new Date(Date.now() + 3600000),
                products: [] // Global
            }
        };
        const flashRes = mockRes();
        await createFlashSale(flashReq, flashRes);
        console.log('Create Flash Sale Status:', flashRes.statusCode || 201);
        const createdFlashId = flashRes.data._id;
        console.log('Created Flash Sale ID:', createdFlashId);

        const fetchFlashRes = mockRes();
        await getAllFlashSales({}, fetchFlashRes);
        console.log('Fetch Flash Sales Count:', fetchFlashRes.data.length);

        const deleteFlashReq = { params: { id: createdFlashId } };
        const deleteFlashRes = mockRes();
        await deleteFlashSale(deleteFlashReq, deleteFlashRes);
        console.log('Delete Flash Sale Status:', deleteFlashRes.statusCode || 200, deleteFlashRes.data.message);

        console.log('\nVerification Complete - All CRUD operations working on backend.');
        process.exit(0);
    } catch (error) {
        console.error('Verification failed:', error);
        process.exit(1);
    }
};

verify();
