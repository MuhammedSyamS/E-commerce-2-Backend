const { getWelcomeTemplate } = require('../utils/emailTemplates');
const logger = require('../utils/logger');
const authService = require('../services/authService');

// --- 1. SEND OTP ---
exports.sendOtp = async (req, res) => {
  try {
    console.log("--- OTP REQUEST RECEIVED ---");
    const { email } = req.body;
    console.log(`Email: ${email}`);

    if (!email) {
      console.log("Error: Email missing");
      return res.status(400).json({ message: "EMAIL IS REQUIRED" });
    }

    const emailLower = email.toLowerCase().trim();

    // Check if user already exists
    const userExists = await User.findOne({ email: emailLower });
    if (userExists) {
      console.log("Error: User already registered");
      return res.status(400).json({ message: "USER ALREADY REGISTERED WITH THIS EMAIL" });
    }

    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`[AUTH] Email for OTP: ${emailLower}`);
    console.log(`[AUTH] Generated Code: ${code}`);

    // Save or Update OTP in DB
    try {
      await Otp.findOneAndUpdate(
        { email: emailLower },
        { code, createdAt: Date.now() },
        { upsert: true, new: true }
      );
      console.log(`[AUTH] [SUCCESS] OTP saved to DB for ${emailLower}`);
    } catch (dbError) {
      console.error(`[AUTH] [DB ERROR] ${dbError.message}`);
      throw dbError;
    }

    // Send Mail using Central Utility
    try {
      await sendEmail({
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
      });
      console.log(`[AUTH] [SUCCESS] Email sent to ${emailLower}`);
      res.status(200).json({ message: "OTP SENT SUCCESSFULLY" });
    } catch (emailError) {
      console.error(`[AUTH] [MAIL ERROR] ${emailError.message}`);
      return res.status(500).json({ 
        message: "COULD NOT SEND EMAIL. PLEASE CHECK YOUR EMAIL ADDRESS OR TRY LATER.",
        error: emailError.message 
      });
    }
  } catch (error) {
    console.error("OTP Error Stack:", error);
    if (res.headersSent) return;
    res.status(500).json({ message: "SERVER ERROR: COULD NOT SEND OTP", error: error.message });
  }
};

// --- 2. REGISTER USER ---
exports.registerUser = async (req, res) => {
  try {
    const { firstName, lastName, email: rawEmail, password, code, phone } = req.body;
    const email = rawEmail?.toLowerCase().trim();

    // The code check and user existence check are moved to the service
    // But some project-specific logic (OTP record check) might stay for now or also move.
    // For a "Clean" refactor, let's move everything related to user creation.
    
    // Check OTP in controller for now as it's a "request" validation step
    const Otp = require('../models/Otp');
    const otpRecord = await Otp.findOne({ email, code: code.trim() });
    if (!otpRecord) {
      return res.status(400).json({ success: false, message: "INVALID OR EXPIRED VERIFICATION CODE" });
    }

    const user = await authService.register(req.body);

    // Clean up OTP
    await Otp.deleteOne({ _id: otpRecord._id });

    res.status(201).json({ success: true, ...user });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message || "REGISTRATION FAILED" });
  }
};

// --- 3. LOGIN USER ---
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await authService.login(email, password);
    res.json({ success: true, ...user });
  } catch (error) {
    res.status(401).json({ success: false, message: error.message || "LOGIN FAILED" });
  }
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

    // Clean up dead wishlist items
    const validWishlist = user.wishlist.filter(item => item !== null);

    if (validWishlist.length !== user.wishlist.length) {
      await User.updateOne({ _id: user._id }, { wishlist: validWishlist.map(p => p._id) });
    }

    res.json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      cart: user.cart,
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
      { upsert: true, new: true }
    );

    // Send Mail using Central Utility
    await sendEmail({
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
    });

    res.status(200).json({ message: "RESET CODE SENT TO EMAIL" });
  } catch (error) {
    console.error("Forgot Password Error:", error);
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
