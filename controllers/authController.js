const User = require('../models/User');
const Otp = require('../models/Otp');
const generateToken = require('../utils/generateToken');
const sendEmail = require('../utils/sendEmail');
const { getWelcomeTemplate } = require('../utils/emailTemplates');

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

    // Field Validation
    if (!firstName || !lastName || !email || !password || !code || !phone) {
      return res.status(400).json({ message: "PLEASE FILL ALL FIELDS" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "PASSWORD MUST BE AT LEAST 6 CHARACTERS" });
    }

    // Verify OTP exists and matches
    const otpRecord = await Otp.findOne({ email, code: code.trim() });
    if (!otpRecord) {
      return res.status(400).json({ message: "INVALID OR EXPIRED VERIFICATION CODE" });
    }

    // Double-check existence to prevent race conditions
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "USER ALREADY REGISTERED" });
    }

    // Create User (Schema's pre-save hook will handle hashing)
    const user = await User.create({
      firstName,
      lastName,
      email,
      phone,
      password, // Plain text sent here, hashed by Schema
      referralCode: Math.random().toString(36).substring(2, 8).toUpperCase()
    });

    // Handle Referral Usage
    if (req.body.referralCode) {
      const referrer = await User.findOne({ referralCode: req.body.referralCode.toUpperCase() });
      if (referrer) {
        user.referredBy = referrer._id;
        await user.save();
      }
    }

    // Clean up OTP record
    await Otp.deleteOne({ _id: otpRecord._id });

    res.status(201).json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      wishlist: user.wishlist, // Init empty
      cart: user.cart,         // Init empty
      token: generateToken(user._id),
    });

    // --- SEND WELCOME EMAIL ---
    try {
      await sendEmail({
        email: user.email,
        subject: `Welcome to SLOOK, ${user.firstName}!`,
        html: getWelcomeTemplate(user)
      });
      console.log(`Welcome email sent to ${user.email}`);
    } catch (emailErr) {
      console.error("Welcome Email Failed:", emailErr);
      // Don't fail registration if email fails
    }
  } catch (error) {
    res.status(500).json({ message: error.message || "REGISTRATION FAILED" });
  }
};

// --- 3. LOGIN USER ---
exports.loginUser = async (req, res) => {
  try {
    const { password } = req.body;
    const email = req.body.email?.toLowerCase().trim();

    if (!email || !password) {
      return res.status(400).json({ message: "EMAIL AND PASSWORD REQUIRED" });
    }

    // Find user and explicitly populate wishlist to weed out deleted products
    const user = await User.findOne({ email }).populate('wishlist');

    // SPECIFIC VALIDATION: Invalid Credentials (Generic Message for Security)
    if (!user) {
      console.warn(`[AUTH] [LOGIN FAIL] User not found: ${email}`);
      return res.status(401).json({ message: "INVALID EMAIL OR PASSWORD" });
    }

    // SPECIFIC VALIDATION: Incorrect Password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      console.warn(`[AUTH] [LOGIN FAIL] Invalid password for: ${email}`);
      return res.status(401).json({ message: "INVALID EMAIL OR PASSWORD" });
    }

    console.log(`[AUTH] [LOGIN SUCCESS] User authenticated: ${email}`);

    // SUCCESS: Clean up dead wishlist items before sending back
    const validWishlist = (user.wishlist || []).filter(item => item !== null);

    // DB cleanup if dead IDs found
    if (validWishlist.length !== user.wishlist.length) {
      await User.updateOne({ _id: user._id }, { wishlist: validWishlist.map(p => p._id) });
    }

    res.json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      wishlist: validWishlist.map(p => p._id), // Only valid IDs
      cart: user.cart,
      phone: user.phone,
      referralCode: user.referralCode,
      referralEarnings: user.referralEarnings,
      loyaltyPoints: user.loyaltyPoints,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: "LOGIN FAILED: SERVER ERROR" });
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
