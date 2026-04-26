const User = require('../models/User');
const Otp = require('../models/Otp');
const sendEmail = require('../utils/sendEmail');
const generateToken = require('../utils/generateToken');
const { getWelcomeTemplate } = require('../utils/emailTemplates');
const logger = require('../utils/logger');
const authService = require('../services/authService');

// --- 1. SEND OTP ---
exports.sendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "EMAIL IS REQUIRED" });
    }

    const emailLower = email.toLowerCase().trim();

    // Check if user already exists
    const userExists = await User.findOne({ email: emailLower });
    if (userExists) {
      return res.status(400).json({ message: "USER ALREADY REGISTERED WITH THIS EMAIL" });
    }

    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Save or Update OTP in DB
    await Otp.findOneAndUpdate(
      { email: emailLower },
      { code, createdAt: Date.now() },
      { upsert: true, returnDocument: 'after' }
    );

    // RESPOND IMMEDIATELY — email is sent in background
    res.status(200).json({ message: "OTP SENT SUCCESSFULLY" });

    // Send email asynchronously (fire-and-forget — does NOT block response)
    sendEmail({
      email: emailLower,
      subject: "Your Verification Code to SLOOK",
      html: `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a; line-height: 1.6; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
          <div style="text-align: center; padding: 40px 0; border-bottom: 1px solid #f5f5f5; background: #fff;">
              <h1 style="font-size: 32px; font-weight: 900; letter-spacing: -1px; margin: 0; text-transform: uppercase;">SLOOK</h1>
              <p style="font-size: 11px; font-weight: 700; letter-spacing: 3px; color: #999; margin-top: 8px; text-transform: uppercase;">Modern Essentials</p>
          </div>
          
          <div style="padding: 50px 30px; text-align: center; background: #fff;">
              <h2 style="font-size: 20px; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 12px; color: #000;">Verify Your Email</h2>
              <p style="color: #666; margin-bottom: 35px; font-size: 15px; max-width: 400px; margin-left: auto; margin-right: auto;">Use the secure code below to complete your sign-up process. Do not share this with anyone.</p>
              
              <div style="background: #000; color: #fff; display: inline-block; padding: 20px 48px; border-radius: 12px; margin-bottom: 35px; box-shadow: 0 10px 25px -10px rgba(0,0,0,0.3);">
                  <span style="font-size: 36px; font-weight: 700; letter-spacing: 12px; font-family: 'Courier New', monospace; display: block; line-height: 1;">${code}</span>
              </div>
              
              <p style="font-size: 13px; color: #888; font-weight: 500;">This code expires in 5 minutes.</p>
          </div>

          <div style="background: #fafafa; border-top: 1px solid #eee; padding: 30px; text-align: center;">
              <p style="font-size: 11px; color: #aaa; margin: 0;">&copy; ${new Date().getFullYear()} SLOOK. All rights reserved.</p>
              <p style="font-size: 11px; color: #ccc; margin-top: 8px;">If you didn't request this email, you can safely ignore it.</p>
          </div>
      </div>`
    }).catch(err => logger.error(`[AUTH] OTP email failed for ${emailLower}: ${err.message}`));

  } catch (error) {
    if (res.headersSent) return;
    res.status(500).json({ message: "SERVER ERROR: COULD NOT SEND OTP", error: error.message });
  }
};

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// --- 2. REGISTER USER ---
exports.registerUser = async (req, res) => {
  try {
    const { email: rawEmail, code } = req.body;
    const email = rawEmail?.toLowerCase().trim();

    const otpRecord = await Otp.findOne({ email, code: code.trim() });
    if (!otpRecord) {
      return res.status(400).json({ success: false, message: "INVALID OR EXPIRED VERIFICATION CODE" });
    }

    const { user, accessToken, refreshToken } = await authService.register(req.body);

    await Otp.deleteOne({ _id: otpRecord._id });

    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);
    res.status(201).json({ success: true, user, accessToken });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message || "REGISTRATION FAILED" });
  }
};

// --- 3. LOGIN USER ---
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const { user, accessToken, refreshToken } = await authService.login(email, password);

    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);
    res.json({ success: true, user, accessToken });
  } catch (error) {
    res.status(401).json({ success: false, message: error.message || "LOGIN FAILED" });
  }
};

// --- 3.1 REFRESH TOKEN (Rotation) ---
exports.refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) return res.status(401).json({ message: 'No refresh token' });

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    
    const user = await User.findById(decoded.id);
    if (!user || user.isBlocked || user.tokenVersion !== decoded.tokenVersion) {
      res.clearCookie('refreshToken', COOKIE_OPTIONS);
      return res.status(401).json({ message: 'Session invalid' });
    }

    // ROTATE: Issue new access AND refresh tokens
    const { generateToken, generateRefreshToken } = require('../utils/generateToken');
    const newAccessToken = generateToken(user._id, user.tokenVersion);
    const newRefreshToken = generateRefreshToken(user._id, user.tokenVersion);

    res.cookie('refreshToken', newRefreshToken, COOKIE_OPTIONS);
    res.json({ accessToken: newAccessToken });
  } catch (err) {
    res.clearCookie('refreshToken', COOKIE_OPTIONS);
    res.status(401).json({ message: 'Refresh failed' });
  }
};

// --- 3.2 LOGOUT ---
exports.logoutUser = async (req, res) => {
  res.clearCookie('refreshToken', COOKIE_OPTIONS);
  res.status(200).json({ success: true, message: 'Logged out successfully' });
};

// --- 3.5 GET USER PROFILE (SYNC) ---
exports.getUserProfile = async (req, res) => {
  try {
    // Populate cart and wishlist to ensure frontend gets full objects
    // Note: If you want just IDs in store, don't populate. 
    // Usually store keeps IDs or minimal info. 
    // For now, let's just return the user doc as is, or with populated wishlist IDs if they are objects.

    // Actually, cart logic in frontend likely expects objects if populated, or IDs.
    // Let's stick to returning what login returns, but fresh.
    // Populate wishlist to detect and remove dead items
    const user = await User.findById(req.user._id).populate('wishlist');

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Clean up and heal cart items
    const Product = require('../models/Product');
    const validWishlist = user.wishlist.filter(item => item !== null);
    
    // Self-Healing Cart: Fill in missing data for any corrupted items
    let cartModified = false;
    const healedCart = [];
    
    for (let item of user.cart) {
        if (!item.product) continue; // Skip dead products
        
        if (!item.name || !item.price || !item.image) {
            const fullProduct = await Product.findById(item.product);
            if (fullProduct) {
                item.name = item.name || fullProduct.name;
                item.price = item.price || fullProduct.price;
                item.image = item.image || fullProduct.image;
                cartModified = true;
            }
        }
        healedCart.push(item);
    }

    const healedSaved = [];
    for (let item of user.savedForLater) {
        if (!item.product) continue;
        if (!item.name || !item.price || !item.image) {
            const fullProduct = await Product.findById(item.product);
            if (fullProduct) {
                item.name = item.name || fullProduct.name;
                item.price = item.price || fullProduct.price;
                item.image = item.image || fullProduct.image;
                cartModified = true;
            }
        }
        healedSaved.push(item);
    }

    if (cartModified || validWishlist.length !== user.wishlist.length) {
      await User.updateOne({ _id: user._id }, { 
          wishlist: validWishlist.map(p => p._id),
          cart: healedCart,
          savedForLater: healedSaved
      });
    }

    res.json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      cart: healedCart,
      savedForLater: healedSaved,
      phone: user.phone,
      wishlist: validWishlist.map(p => p._id), // Only valid IDs
      referralCode: user.referralCode,
      referralEarnings: user.referralEarnings,
      loyaltyPoints: user.loyaltyPoints,
      token: generateToken(user._id), // Optional: refresh token
    });
  } catch (error) {
    res.status(500).json({ message: "Profile fetch failed" });
  }
};

// --- 4. FORGOT PASSWORD: SEND OTP ---
exports.forgotPasswordOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "EMAIL IS REQUIRED" });

    const emailLower = email.toLowerCase().trim();

    // Check if user exists (Generic response for security)
    const user = await User.findOne({ email: emailLower });
    if (!user) {
      return res.status(200).json({ message: "RESET CODE SENT TO EMAIL" }); 
    }

    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Update or Create OTP in DB
    await Otp.findOneAndUpdate(
      { email: emailLower },
      { code, createdAt: Date.now() },
      { upsert: true, returnDocument: 'after' }
    );

    // RESPOND IMMEDIATELY — email is sent in background
    res.status(200).json({ message: "RESET CODE SENT TO EMAIL" });

    // Send email asynchronously (fire-and-forget — does NOT block response)
    sendEmail({
      email: emailLower,
      subject: "Reset Your Password",
      html: `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a; line-height: 1.6; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
            <div style="text-align: center; padding: 40px 0; border-bottom: 1px solid #f5f5f5; background: #fff;">
                <h1 style="font-size: 32px; font-weight: 900; letter-spacing: -1px; margin: 0; text-transform: uppercase;">SLOOK</h1>
                <p style="font-size: 11px; font-weight: 700; letter-spacing: 3px; color: #999; margin-top: 8px; text-transform: uppercase;">Modern Essentials</p>
            </div>
            
            <div style="padding: 50px 30px; text-align: center; background: #fff;">
                <h2 style="font-size: 20px; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 12px; color: #000;">Reset Password Request</h2>
                <p style="color: #666; margin-bottom: 35px; font-size: 15px; max-width: 400px; margin-left: auto; margin-right: auto;">We received a request to access your account. Use the code below to reset your password.</p>
                
                <div style="background: #000; color: #fff; display: inline-block; padding: 20px 48px; border-radius: 12px; margin-bottom: 35px; box-shadow: 0 10px 25px -10px rgba(0,0,0,0.3);">
                    <span style="font-size: 36px; font-weight: 700; letter-spacing: 12px; font-family: 'Courier New', monospace; display: block; line-height: 1;">${code}</span>
                </div>
                
                <p style="font-size: 13px; color: #888; font-weight: 500;">If this wasn't you, please secure your account immediately.</p>
            </div>

            <div style="background: #fafafa; border-top: 1px solid #eee; padding: 30px; text-align: center;">
                <p style="font-size: 11px; color: #aaa; margin: 0;">&copy; ${new Date().getFullYear()} SLOOK. All rights reserved.</p>
            </div>
        </div>`
    }).catch(err => logger.error(`[AUTH] Forgot-password email failed for ${emailLower}: ${err.message}`));

  } catch (error) {
    console.error("Forgot Password Error:", error);
    if (res.headersSent) return;
    res.status(500).json({ message: "SERVER ERROR: COULD NOT SEND RESET CODE", error: error.message });
  }
};

// --- 5. RESET PASSWORD ---
exports.resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({ message: "PLEASE FILL ALL FIELDS" });
    }

    const emailLower = email.toLowerCase().trim();

    // Verify OTP matches
    const otpRecord = await Otp.findOne({ email: emailLower, code: code.trim() });
    if (!otpRecord) {
      return res.status(400).json({ message: "INVALID OR EXPIRED RESET CODE" });
    }

    const user = await User.findOne({ email: emailLower });
    if (!user) return res.status(404).json({ message: "USER NOT FOUND" });

    // Update Password (Schema pre-save hook will hash this)
    user.password = newPassword;
    await user.save();

    // Delete OTP
    await Otp.deleteOne({ _id: otpRecord._id });

    res.status(200).json({ message: "PASSWORD RESET SUCCESSFUL" });
  } catch (error) {
    res.status(500).json({ message: "SERVER ERROR: RESET FAILED" });
  }
};
