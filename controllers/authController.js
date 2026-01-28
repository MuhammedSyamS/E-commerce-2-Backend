const User = require('../models/User');
const Otp = require('../models/Otp');
const nodemailer = require('nodemailer');
const generateToken = require('../utils/generateToken');

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
      { upsert: true, new: true }
    );

    // Configure Mailer
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });

    // Send Mail
    await transporter.sendMail({
      from: `"MISO STUDIO" <${process.env.EMAIL_USER}>`,
      to: emailLower,
      subject: "VERIFICATION CODE",
      html: `
        <div style="text-align:center; font-family:sans-serif; padding:20px; border:1px solid #eee;">
          <h2 style="letter-spacing: 2px;">MISO STUDIO</h2>
          <p style="color: #666;">YOUR VERIFICATION CODE IS:</p>
          <h1 style="background:#000; color:#fff; display:inline-block; padding:10px 25px; letter-spacing:8px;">${code}</h1>
          <p style="font-size: 12px; color: #999; margin-top: 20px;">This code expires in 5 minutes.</p>
        </div>`
    });

    res.status(200).json({ message: "OTP SENT SUCCESSFULLY" });
  } catch (error) {
    console.error("OTP Error:", error);
    res.status(500).json({ message: "SERVER ERROR: COULD NOT SEND OTP" });
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
      token: generateToken(user._id),
    });
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
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: "LOGIN FAILED: SERVER ERROR" });
  }
};