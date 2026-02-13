const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  orderItems: [{
    name: { type: String, required: true },
    qty: { type: Number, required: true },
    image: { type: String, required: true },
    price: { type: Number, required: true },
    selectedVariant: {
      size: String,
      color: String,
      price: Number
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    status: {
      type: String,
      required: true,
      default: 'Ordered',
      enum: ['Ordered', 'Cancelled', 'Return Requested', 'Returned', 'Exchange Requested', 'Exchanged', 'Delivered']
    }
  }],

  orderStatus: {
    type: String,
    required: true,
    enum: ['Pending', 'Processing', 'Confirmed', 'Dispatched', 'Shipped', 'Delivered', 'Cancelled', 'Return Requested', 'Returned'],
    default: 'Pending'
  },
  shippingAddress: {
    address: { type: String, required: true },
    city: { type: String, required: true },
    postalCode: { type: String, required: true },
    phone: { type: String, required: true },
  },
  deliveryPartner: { type: String }, // New Field
  trackingId: { type: String },      // New Field
  paymentMethod: { type: String, required: true },
  couponCode: { type: String },      // Coupon Applied
  discountAmount: { type: Number, default: 0 }, // Discount Value
  totalPrice: { type: Number, required: true, default: 0.0 },
  isPaid: { type: Boolean, required: true, default: false },
  paidAt: { type: Date },
  paymentResult: {
    id: { type: String },
    status: { type: String },
    update_time: { type: String },
    email_address: { type: String },
  },
  isDispatched: { type: Boolean, required: true, default: false },
  isDelivered: { type: Boolean, required: true, default: false },
  deliveredAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);