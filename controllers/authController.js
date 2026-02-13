const User = require('../models/User');
const Otp = require('../models/Otp');
const nodemailer = require('nodemailer');
const generateToken = require('../utils/generateToken');
const sendEmail = require('../utils/sendEmail');
const { getWelcomeTemplate } = require('../utils/emailTemplates');

// --- 1. SEND OTP ---
// --- 1. SEND OTP ---
exports.sendOtp = async (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const logFile = path.join(__dirname, '../debug_otp.log');

  const log = (msg) => {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logFile, `[${timestamp}] ${msg}\n`);
    console.log(msg); // Also log to console
  };

  try {
    log("--- OTP REQUEST RECEIVED ---");
    const { email } = req.body;
    log(`Email: ${email}`);

    if (!email) {
      log("Error: Email missing");
      return res.status(400).json({ message: "EMAIL IS REQUIRED" });
    }

    const emailLower = email.toLowerCase().trim();

    // Check if user already exists
    const userExists = await User.findOne({ email: emailLower });
    if (userExists) {
      log("Error: User already registered");
      return res.status(400).json({ message: "USER ALREADY REGISTERED WITH THIS EMAIL" });
    }

    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    log(`Generated Code for ${emailLower}: ${code}`);

    // Save or Update OTP in DB
    try {
      await Otp.findOneAndUpdate(
        { email: emailLower },
        { code, createdAt: Date.now() },
        { upsert: true, new: true }
      );
      log("OTP Saved to DB");
    } catch (dbError) {
      log(`DB Error: ${dbError.message}`);
      throw dbError;
    }

    // Configure Mailer with more robust settings
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    // Verify connection execution
    try {
      await transporter.verify();
      log("Nodemailer Connected Successfully");
    } catch (verifyError) {
      log(`Nodemailer Connection Failed: ${verifyError.message}`);
      return res.status(500).json({ message: "EMAIL SERVICE CONFIGURATION ERROR" });
    }

    // Send Mail
    await transporter.sendMail({
      from: `"SLOOK Security" <${process.env.EMAIL_USER}>`,
      to: emailLower,
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

    log("Email sent successfully");
    res.status(200).json({ message: "OTP SENT SUCCESSFULLY" });
  } catch (error) {
    console.error("OTP Error Stack:", error);
    if (res.headersSent) return;
    res.status(500).json({ message: "SERVER ERROR: COULD NOT SEND OTP", error: error.message });
  }
};

// --- 2. REGISTER USER ---
exports.registerUser = async (req, res) => {
  try {
    const { firstName, lastName, password, code } = req.body;
    const email = req.body.email?.toLowerCase().trim();

    // Field Validation
    if (!firstName || !lastName || !email || !password || !code) {
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
      password // Plain text sent here, hashed by Schema
    });

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

    // Find user
    const user = await User.findOne({ email });

    // SPECIFIC VALIDATION: No User Found
    if (!user) {
      return res.status(404).json({ message: "NO ACCOUNT FOUND WITH THIS EMAIL" });
    }

    // SPECIFIC VALIDATION: Incorrect Password
    // matchesPassword uses bcrypt.compare internally via your User model
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "INCORRECT PASSWORD. PLEASE TRY AGAIN." });
    }

    // Success
    res.json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      isAdmin: user.isAdmin, // Added
      role: user.role,       // Added
      permissions: user.permissions, // Added
      wishlist: user.wishlist,
      cart: user.cart,
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
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      isAdmin: user.isAdmin,
      role: user.role,       // Added
      permissions: user.permissions, // Added
      cart: user.cart,
      wishlist: user.wishlist,
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

    // Check if user exists
    const user = await User.findOne({ email: emailLower });
    if (!user) {
      return res.status(404).json({ message: "NO ACCOUNT FOUND WITH THIS EMAIL" });
    }

    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Update or Create OTP in DB
    await Otp.findOneAndUpdate(
      { email: emailLower },
      { code, createdAt: Date.now() },
      { upsert: true, new: true }
    );

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    await transporter.sendMail({
      from: `"SLOOK Security" <${process.env.EMAIL_USER}>`,
      to: emailLower,
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