const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: false },
  password: { type: String, required: true },
  role: { type: String, enum: ['customer', 'admin', 'manager', 'delivery'], default: 'customer' }, // NEW: Role Management
  isBlocked: { type: Boolean, default: false }, // NEW: Block User
  isAdmin: { type: Boolean, required: true, default: false },
  isSuperAdmin: { type: Boolean, default: false }, // Full Access
  loyaltyPoints: { type: Number, default: 0 }, // NEW: Loyalty Program
  totalSpent: { type: Number, default: 0 }, // NEW: Lifecycle Tracking
  membershipTier: {
    type: String,
    enum: ['Bronze', 'Silver', 'Gold', 'Platinum'],
    default: 'Bronze'
  },
  permissions: [{ type: String }], // Granular access: 'manage_orders', 'manage_products', 'view_stats'
  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: [] }],
  cart: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    quantity: { type: Number, default: 1 },
    name: String,
    price: Number,
    image: String,
    selectedVariant: {
      size: String,
      color: String,
      price: Number,
      stock: Number
    }
  }],
  savedForLater: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    quantity: { type: Number, default: 1 },
    name: String,
    price: Number,
    image: String,
    selectedVariant: {
      size: String,
      color: String,
      price: Number,
      stock: Number
    }
  }],
  recentlyViewed: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    viewedAt: { type: Date, default: Date.now }
  }],
  // NEW FIELDS
  addresses: [{
    label: String, // e.g., "Home", "Work"
    street: String,
    city: String,
    state: String,
    zip: String,
    phone: String,
    isDefault: { type: Boolean, default: false }
  }],
  notifications: [{
    title: String,
    message: String,
    type: { type: String, enum: ['order', 'promo', 'system'], default: 'system' }, // order, promo, system
    isRead: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  }],
  pushSubscription: { type: Object }, // Store VAPID subscription object
  savedCards: [{
    last4: String,
    brand: String, // Visa, MasterCard
    expMonth: String,
    expYear: String,
    cvv: String // Added for demo purposes
  }],
  abandonedCartEmailSentAt: { type: Date }, // Track when we last nudged them
  // REFERRAL SYSTEM
  referralCode: { type: String, unique: true, sparse: true },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  referralEarnings: { type: Number, default: 0 },
  hasMadeFirstOrder: { type: Boolean, default: false }, // To track if referrer paid
  // GOOGLE AUTH
  googleId: { type: String, unique: true, sparse: true },
  avatar: { type: String },
  // OTP FOR SECURITY
  otp: { type: String },
  otpExpires: { type: Date }
}, { timestamps: true });

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
