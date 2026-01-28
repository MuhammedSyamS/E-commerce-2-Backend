const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: true,
    trim: true,
    lowercase: true 
  },
  code: { 
    type: String, 
    required: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now, 
    expires: 600 // This automatically handles the index creation.
  }
});

// REMOVE the extra otpSchema.index({ createdAt: 1 }...) line if it's still there.

module.exports = mongoose.model('Otp', otpSchema);