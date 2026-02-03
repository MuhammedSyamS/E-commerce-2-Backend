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
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    status: {
      type: String,
      required: true,
      default: 'Ordered',
      enum: ['Ordered', 'Cancelled', 'Return Requested', 'Returned', 'Exchange Requested', 'Exchanged']
    },
    returnReason: { type: String } // Reason for return/exchange
  }],
  orderStatus: {
    type: String,
    required: true,
    enum: ['Pending', 'Confirmed', 'Packed', 'Shipped', 'Delivered', 'Cancelled', 'Return Requested', 'Returned'],
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
  totalPrice: { type: Number, required: true, default: 0.0 },
  isPaid: { type: Boolean, required: true, default: false },
  paidAt: { type: Date },
  isDispatched: { type: Boolean, required: true, default: false },
  isDelivered: { type: Boolean, required: true, default: false },
  deliveredAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);