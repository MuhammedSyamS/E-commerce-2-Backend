const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isAdmin: { type: Boolean, default: false },
  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: [] }],
  cart: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    quantity: { type: Number, default: 1 },
    name: String,
    price: Number,
    image: String
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
  savedCards: [{
    last4: String,
    brand: String, // Visa, MasterCard
    expMonth: String,
    expYear: String
  }]
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