const logger = require('../utils/logger');
const { uploadMedia, deleteMedia, extractMediaId, getResourceType } = require('../services/mediaService');
const User = require('../models/User');
const Product = require('../models/Product');


logger.info("UserController loaded");

// @desc    Toggle product in wishlist
// @route   POST /api/users/wishlist
// @access  Private
exports.toggleWishlist = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const { productId } = req.body;

    if (!user) return res.status(404).json({ message: "User not found" });

    // Check if product is already in wishlist
    const isAdded = user.wishlist.some(id => id.toString() === productId);

    if (isAdded) {
      // Remove it
      user.wishlist = user.wishlist.filter((id) => id.toString() !== productId);
    } else {
      // Add it
      user.wishlist.push(productId);
    }

    await user.save();

    // Populate before returning so frontend has full product details
    await user.populate('wishlist');

    res.status(200).json(user.wishlist);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Bulk add to wishlist (Guest Sync)
// @route   POST /api/users/wishlist/bulk
// @access  Private
exports.bulkWishlist = async (req, res) => {
  try {
    const { productIds } = req.body;
    if (!productIds || !Array.isArray(productIds)) return res.status(400).json({ message: "Invalid product IDs" });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Merge unique IDs
    const existingIds = user.wishlist.map(id => id.toString());
    // Filter out potential non-ObjectId strings or empty values
    const validIds = productIds.filter(id => id && id.length === 24);
    const newIds = validIds.filter(id => !existingIds.includes(id));

    if (newIds.length > 0) {
      user.wishlist.push(...newIds);
      await user.save();
    }

    await user.populate('wishlist');
    res.status(200).json(user.wishlist);
  } catch (error) {
    console.error("Bulk Wishlist Error:", error);
    res.status(500).json({ message: "Failed to sync wishlist" });
  }
};

// @desc    Get user wishlist
// @route   GET /api/users/wishlist
// @access  Private
exports.getWishlist = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('wishlist');
    if (!user) return res.status(404).json({ message: "User not found" });

    // Filter out nulls (in case product was deleted but ID remains)
    const validWishlist = user.wishlist.filter(item => item !== null);

    if (validWishlist.length !== user.wishlist.length) {
      user.wishlist = validWishlist;
      await user.save();
    }

    res.json(validWishlist);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch wishlist" });
  }
};

// @desc    Record product view for recommendations
// @route   POST /api/users/history
// @access  Private
exports.recordView = async (req, res) => {
  try {
    const { productId } = req.body;
    if (!productId) return res.status(400).json({ message: "Product ID required" });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Remove if already exists to move to front
    user.recentlyViewed = user.recentlyViewed.filter(
      item => item.product.toString() !== productId
    );

    // Add to beginning
    user.recentlyViewed.unshift({ product: productId, viewedAt: Date.now() });

    // Keep only last 20
    if (user.recentlyViewed.length > 20) {
      user.recentlyViewed = user.recentlyViewed.slice(0, 20);
    }

    await user.save();
    res.status(200).json({ message: "View recorded" });
  } catch (error) {
    console.error("RECORD VIEW ERROR:", error);
    res.status(500).json({ message: "Failed to record view" });
  }
};

// @desc    Get recently viewed products
// @route   GET /api/users/recently-viewed
// @access  Private
exports.getRecentlyViewed = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate({
        path: 'recentlyViewed.product',
        select: 'name slug price image images category rating numReviews countInStock'
      });

    if (!user) return res.status(404).json({ message: "User not found" });

    // Filter out items where product may have been deleted and map to product objects
    const products = user.recentlyViewed
      .filter(item => item.product !== null)
      .map(item => item.product);

    res.json(products);
  } catch (error) {
    console.error("GET RECENTLY VIEWED ERROR:", error);
    res.status(500).json({ message: "Failed to fetch recently viewed" });
  }
};
// @desc    Google Login / Register
// @route   POST /api/users/google-login
// @access  Public
exports.googleLogin = async (req, res) => {
  const vault = require('../config/vault');
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ message: "Google ID Token is required." });
    }

    const { OAuth2Client } = require('google-auth-library');
    const googleClientId = vault.GOOGLE_CLIENT_ID;
    
    if (!googleClientId) {
      logger.error("Google Login Error: GOOGLE_CLIENT_ID is missing from configuration.");
      return res.status(500).json({ message: "Server configuration error. Please contact support." });
    }

    const client = new OAuth2Client(googleClientId);

    logger.debug("Verifying Google ID Token...");
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: googleClientId
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw new Error("Failed to get payload from Google Ticket");
    }

    const { name, email, picture, sub: googleId } = payload;
    logger.info(`Google Login Attempt for email: ${email}`);

    // Check if user exists (by googleId OR email)
    let user = await User.findOne({ $or: [{ googleId }, { email }] });

    if (user) {
      // Connect Google ID if not already connected (e.g. detailed email match)
      if (!user.googleId) {
        logger.info(`Connecting existing user ${email} with Google ID ${googleId}`);
        user.googleId = googleId;
        if (!user.avatar) user.avatar = picture;
        await user.save();
      }
    } else {
      logger.info(`Creating new user for ${email} through Google Register`);
      // Create New User
      // Generate secure random password
      const crypto = require('crypto');
      const randomPassword = crypto.randomBytes(24).toString('base64');

      // Split name
      const nameParts = name.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'User';

      user = await User.create({
        firstName,
        lastName,
        email,
        password: randomPassword,
        googleId,
        avatar: picture
      });
    }

    const generateToken = (id) => {
      const jwt = require('jsonwebtoken');
      return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    };

    const userData = user.toObject();
    delete userData.password;
    delete userData.otp;
    delete userData.otpExpires;
    userData.token = generateToken(user._id);

    res.json(userData);

  } catch (error) {
    logger.error("Google Login Backend Exception:", {
      message: error.message,
      stack: error.stack,
      clientIdPresent: !!vault.GOOGLE_CLIENT_ID
    });
    
    const clientIdHint = vault.GOOGLE_CLIENT_ID 
      ? `${vault.GOOGLE_CLIENT_ID.substring(0, 5)}...${vault.GOOGLE_CLIENT_ID.slice(-5)}` 
      : "MISSING";

    res.status(400).json({ 
      message: "Google Login Failed", 
      details: `${error.message} (Configured ID: ${clientIdHint})`
    });
  }
};
exports.recordView = async (req, res) => {
  try {
    const { productId } = req.body;
    if (!productId) return res.status(400).json({ message: "Product ID required" });

    // Use findOneAndUpdate for atomic operation
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { recentlyViewed: { product: productId } } // Remove if exists (to push to top)
    });

    const user = await User.findByIdAndUpdate(req.user._id, {
      $push: {
        recentlyViewed: {
          $each: [{ product: productId, viewedAt: new Date() }],
          $position: 0,
          $slice: 20 // Keep last 20 views
        }
      }
    }, { returnDocument: 'after' });

    res.status(200).json(user.recentlyViewed);
  } catch (error) {
    console.error("Record View Error:", error);
    res.status(500).json({ message: "Failed to record view" });
  }
};

// --- NEW METHODS ---

// @desc    Add a new address
// @route   POST /api/users/addresses
// @access  Private
exports.addAddress = async (req, res) => {
  try {
    const newAddress = req.body;
    // Use $push to atomic update without re-validating entire user doc (safer for legacy data)
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $push: { addresses: newAddress } },
      { returnDocument: 'after' }
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(201).json(user.addresses);
  } catch (error) {
    console.error("ADD ADDRESS ERROR:", error);
    res.status(500).json({ message: "Failed to add address: " + error.message });
  }
};

// @desc    Update basic profile
exports.updateAvatar = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file selected' });
        }

        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: "User not found" });

        // --- MEDIA CLEANUP ---
        if (user.avatar) {
            const oldId = extractMediaId(user.avatar);
            if (oldId) {
                deleteMedia(oldId, getResourceType(user.avatar)).catch(err => console.error("Media Service Delete Error (Old Avatar):", err));
            }
        }
        // -------------------------

        const result = await uploadMedia(req.file.buffer, 'avatars', req.file.originalname);
        user.avatar = result.secure_url;
        await user.save();

        res.json({
            message: 'Avatar updated successfully',
            avatar: user.avatar
        });
    } catch (error) {
        console.error("Avatar Update Error:", error);
        res.status(500).json({ message: 'Avatar update failed' });
    }
};

// @desc    Remove an address
// @route   DELETE /api/users/addresses/:id
// @access  Private
exports.removeAddress = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $pull: { addresses: { _id: req.params.id } } },
      { returnDocument: 'after' }
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json(user.addresses);
  } catch (error) {
    console.error("REMOVE ADDRESS ERROR:", error);
    res.status(500).json({ message: "Failed to delete address" });
  }
};

// @desc    Update basic profile
// @route   PUT /api/users/profile
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    console.log("UPDATE PROFILE REQUEST:", req.body);
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.firstName = req.body.firstName || user.firstName;
    user.lastName = req.body.lastName || user.lastName;

    // Explicitly handle phone update
    if (req.body.phone !== undefined) {
      user.phone = req.body.phone;
    }

    if (req.body.password) {
      // REQUIRE OTP FOR PASSWORD CHANGE
      const { otp } = req.body;
      if (!otp) {
        return res.status(400).json({ message: "Verification code is required to change password." });
      }

      if (!user.otp || user.otp !== otp || user.otpExpires < Date.now()) {
        return res.status(400).json({ message: "Invalid or expired verification code." });
      }

      if (!req.body.currentPassword) {
        return res.status(400).json({ message: "Current password is required to set a new password." });
      }

      // Check if current password matches
      if (!(await user.matchPassword(req.body.currentPassword))) {
        return res.status(400).json({ message: "The current password you entered is incorrect." });
      }

      // Clear OTP after use
      user.otp = undefined;
      user.otpExpires = undefined;
      user.password = req.body.password;
    }

    const updatedUser = await user.save();

    const userData = updatedUser.toObject();
    delete userData.password;
    delete userData.otp;
    delete userData.otpExpires;

    userData.token = req.headers.authorization.split(' ')[1];

    res.json(userData);
  } catch (error) {
    console.error("UPDATE ERROR:", error);
    res.status(500).json({ message: error.message || "Update failed" });
  }
};

// @desc    Get user profile (Sync/Fresh Data)
// @route   GET /api/users/profile
// @access  Private
// --- INTERNAL HELPER: SYNC/HEAL LOYALTY DATA ---
const syncUserLoyalty = async (userId, forceSync = false) => {
  try {
    const mongoose = require('mongoose');
    const LoyaltyTransaction = require('../models/LoyaltyTransaction');
    const Order = require('../models/Order');
    const User = require('../models/User');

    const oid = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

    // 1. Check throttle: Only sync if forced or 5 minutes past last sync
    const user = await User.findById(oid).select('loyaltyPoints totalSpent membershipTier lastLoyaltySync email');
    if (!user) return null;

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (!forceSync && user.lastLoyaltySync && user.lastLoyaltySync > fiveMinutesAgo) {
      return { loyaltyPoints: user.loyaltyPoints, totalSpent: user.totalSpent, membershipTier: user.membershipTier };
    }

    // 2. Recalculate true balance from transactions
    const allTx = await LoyaltyTransaction.find({ user: oid }).sort({ createdAt: -1 }).lean();
    const trueBalance = allTx.reduce((sum, tx) => {
      if (['earn', 'bonus', 'referral', 'refund'].includes(tx.type)) return sum + (tx.amount || 0);
      if (['spend', 'expire'].includes(tx.type)) return sum - (tx.amount || 0);
      return sum;
    }, 0);
    const correctedBalance = Math.max(0, trueBalance);

    // 3. Recalculate total spent from completed orders
    const completedOrders = await Order.find({
      user: oid,
      orderStatus: { $nin: ['Cancelled', 'Returned', 'Refunded', 'Failed'] },
      $or: [{ isPaid: true }, { paymentMethod: 'cod' }]
    }).select('totalPrice').lean();
    const trueTotalSpent = completedOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);

    // 4. Determine Tier
    let newTier = 'Bronze';
    if (trueTotalSpent >= 50000) newTier = 'Platinum';
    else if (trueTotalSpent >= 20000) newTier = 'Gold';
    else if (trueTotalSpent >= 5000) newTier = 'Silver';

    // 5. Update if necessary
    const needsUpdate = user.loyaltyPoints !== correctedBalance ||
      user.totalSpent !== trueTotalSpent ||
      user.membershipTier !== newTier;

    const updatePayload = { lastLoyaltySync: new Date() };
    if (needsUpdate) {
      console.log(`[REPAIR] User ${user.email}: Points ${user.loyaltyPoints}->${correctedBalance}, Tier ${user.membershipTier}->${newTier}`);
      updatePayload.loyaltyPoints = correctedBalance;
      updatePayload.totalSpent = trueTotalSpent;
      updatePayload.membershipTier = newTier;
    }

    await User.updateOne({ _id: oid }, { $set: updatePayload });

    return {
      loyaltyPoints: needsUpdate ? correctedBalance : user.loyaltyPoints,
      totalSpent: needsUpdate ? trueTotalSpent : user.totalSpent,
      membershipTier: needsUpdate ? newTier : user.membershipTier
    };
  } catch (err) {
    console.error("syncUserLoyalty failed:", err);
    return null;
  }
};

// @desc    Get current user profile
// @route   GET /api/users/profile
// @access  Private
exports.getUserProfile = async (req, res) => {
  try {
    // SYNC LOYALTY (Throttled internally, non-blocking for better UX)
    // syncUserLoyalty(req.user._id).catch(err => console.error("Async Loyalty Sync Fail:", err));

    // Fetch user with essential fields and populated wishlist
    const user = await User.findById(req.user._id)
      .populate({ path: 'wishlist', select: 'name slug price image countInStock' })
      .lean();

    if (!user) return res.status(404).json({ message: "User not found" });

    // 1. SELF-HEALING CART/WISHLIST (Targeted Updates - Throttled)
    // Only heal if cart exists and it's been a while (or first time)
    if (user.cart && user.cart.length > 0) {
      const validCart = [];

      let cartModified = false;
      
      // Filter out items that explicitly have null product field first (no DB check needed)
      const initialCart = user.cart.filter(item => {
        if (!item.product) {
          cartModified = true;
          return false;
        }
        return true;
      });

      // ONLY perform DB presence check if requested via query or occasionally
      if (req.query.heal === 'true') {
        const existenceChecks = await Promise.all(initialCart.map(item => Product.exists({ _id: item.product })));
        initialCart.forEach((item, idx) => {
          if (existenceChecks[idx]) validCart.push(item);
          else {
            cartModified = true;
            console.log(`[HEAL] Removing non-existent product ${item.product} from cart of ${user.email}`);
          }
        });
      } else {
        validCart.push(...initialCart);
      }

      if (cartModified) await User.updateOne({ _id: user._id }, { $set: { cart: validCart } });
    }

    // Clean up sensitive fields
    const { password, otp, otpExpires, ...userData } = user;

    res.json(userData);
  } catch (error) {
    console.error("Profile Fetch Error:", error);
    res.status(500).json({ message: "Fetch failed" });
  }
};

// @desc    Get user notifications
// @route   GET /api/users/notifications
// @access  Private
exports.getNotifications = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const Notification = require('../models/Notification');
    // Fetch from Notification Collection
    const notifications = await Notification.find({
      $or: [{ user: req.user._id }, { user: null }] // Include global alerts
    }).sort({ createdAt: -1 }).limit(20).lean();

    res.json(notifications);

  } catch (error) {
    console.error("Notif Fetch Error:", error);
    res.status(500).json({ message: "Fetch failed" });
  }
};

// @desc    Mark notification as read
// @route   PUT /api/users/notifications/:id/read
// @access  Private
exports.markNotificationRead = async (req, res) => {
  try {
    const Notification = require('../models/Notification');
    const notif = await Notification.findById(req.params.id);

    if (notif) {
      notif.isRead = true;
      await notif.save();
      res.json(notif);
    } else {
      res.status(404).json({ message: "Notification not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Update failed" });
  }
};

// @desc    Add a saved card
// @route   POST /api/users/cards
// @access  Private
exports.addCard = async (req, res) => {
  try {
    // Expects { last4, brand, expMonth, expYear }
    const newCard = req.body;

    if (!newCard.last4 || !newCard.brand) {
      return res.status(400).json({ message: "Invalid card data" });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $push: { savedCards: newCard } },
      { returnDocument: 'after' }
    );

    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(201).json(user.savedCards);
  } catch (error) {
    console.error("ADD CARD ERROR:", error);
    res.status(500).json({ message: "Failed to save card: " + error.message });
  }
};

// @desc    Remove a saved card
// @route   DELETE /api/users/cards/:id
// @access  Private
exports.removeCard = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $pull: { savedCards: { _id: req.params.id } } },
      { returnDocument: 'after' }
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json(user.savedCards);
  } catch (error) {
    console.error("REMOVE CARD ERROR:", error);
    res.status(500).json({ message: "Failed to remove card" });
  }
};

// --- ADMIN CONTROLLERS ---

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
exports.getUsers = async (req, res) => {
  try {
    const pageSize = Number(req.query.pageSize) || 20;
    const page = Number(req.query.page) || 1;
    const search = req.query.search || '';

    // Search Filter
    const query = search ? {
      $or: [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ]
    } : {};

    const count = await User.countDocuments(query);
    const users = await User.find(query)
      .select('-password')
      .limit(pageSize)
      .skip(pageSize * (page - 1))
      .sort({ createdAt: -1 });

    res.json({
      users,
      page,
      pages: Math.ceil(count / pageSize),
      total: count
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch users" });
  }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/Admin
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (user) {
      // --- MEDIA CLEANUP ---
      if (user.avatar) {
        const mediaId = extractMediaId(user.avatar);
        if (mediaId) {
          deleteMedia(mediaId, getResourceType(user.avatar)).catch(err => console.error("Media Service Delete Error (User Avatar):", err));
        }
      }
      // -------------------------

      await User.deleteOne({ _id: user._id }); // Use deleteOne instead of remove()
      res.json({ message: 'User removed' });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: "Failed to delete user" });
  }
};

// @desc    Update user role
// @route   PUT /api/users/:id/role
// @access  Private/Admin
exports.updateUserRole = async (req, res) => {
  try {
    console.log(`UPDATE ROLE REQUEST for ${req.params.id}:`, JSON.stringify(req.body, null, 2));
    // 1. Fetch user for checks (Protection Logic)
    const user = await User.findById(req.params.id);
    console.log(`Current User State: Role=${user.role}, IsAdmin=${user.isAdmin}`);
    if (!user) return res.status(404).json({ message: 'User not found' });

    let update = {};

    // Update role if provided
    if (req.body.role) {
      const newRole = req.body.role;

      // PROTECTION: Prevent removing the last admin
      if ((user.role === 'admin' || user.isAdmin) && newRole !== 'admin') {
        const adminCount = await User.countDocuments({ $or: [{ role: 'admin' }, { isAdmin: true }] });
        console.log(`Admin Count Check: ${adminCount}`);
        if (adminCount <= 1) {
          return res.status(400).json({ message: 'Action Denied: You cannot remove the last Administrator. Please assign another Admin first.' });
        }
      }

      update.role = newRole;
      update.isAdmin = (newRole === 'admin');

      // Handle Permissions
      if (req.body.permissions) {
        update.permissions = req.body.permissions;
      } else if (newRole !== 'manager') {
        // Clear permissions if not manager
        update.permissions = [];
      } else {
        // If manager but no permissions sent, keep existing (do nothing to update.permissions)
      }
    } else {
      // Fallback legacy toggle (Admin <-> Customer)
      // Check protection if toggling OFF admin
      if (user.isAdmin) {
        const adminCount = await User.countDocuments({ isAdmin: true });
        if (adminCount <= 1) {
          return res.status(400).json({ message: 'Action Denied: You cannot remove the last Administrator.' });
        }
      }
      const newIsAdmin = !user.isAdmin;
      update.isAdmin = newIsAdmin;
      update.role = newIsAdmin ? 'admin' : 'customer';
      if (!newIsAdmin) update.permissions = [];
    }

    // Use findByIdAndUpdate to bypass strict validation on other fields
    const updatedUser = await User.findByIdAndUpdate(req.params.id, update, { returnDocument: 'after' });

    console.log("User updated successfully:", updatedUser.role, updatedUser.permissions, updatedUser.isAdmin);
    res.json(updatedUser);
  } catch (error) {
    console.error("UPDATE ROLE ERROR:", error);
    res.status(500).json({ message: "Failed to update role: " + error.message });
  }
};

// @desc    Block or Unblock user
// @route   PUT /api/users/:id/block
// @access  Private/Admin
exports.toggleBlockUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.isBlocked = !user.isBlocked;
    const updatedUser = await user.save();
    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: "Failed to update block status" });
  }
};

// @desc    Update user permissions
// @route   PUT /api/users/:id/permissions
// @access  Private/Admin (Super Admin only check in middleware)
exports.updateUserPermissions = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Expecting array of strings e.g. ['manage_orders']
    console.log(`Updating permissions for user ${user.email} to:`, req.body.permissions);

    if (req.body.permissions) {
      user.permissions = req.body.permissions;
    }

    const updatedUser = await user.save();
    console.log("Permissions saved successfully");
    res.json(updatedUser);
  } catch (error) {
    console.error("PERMISSION UPDATE ERROR:", error);
    res.status(500).json({ message: "Failed to update permissions: " + error.message });
  }
};

// @desc    Get system logs
// @route   GET /api/users/logs
// @access  Private/Admin
exports.getLogs = async (req, res) => {
  try {
    // For now, return mock logs or a simple activity trail if available
    // Since we don't have a dedicated Log model yet, we can return recent user creations or similar
    // Or just return an empty array to stop the loading spinner
    const recentUsers = await User.find().sort({ createdAt: -1 }).limit(10);

    // Transform into log-like structure
    const logs = recentUsers.map(u => ({
      _id: u._id,
      createdAt: u.createdAt,
      user: u,
      action: 'USER_REGISTER',
      details: `User ${u.firstName} joined`
    }));

    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch logs" });
  }
};

// @desc    Get Referral Stats for a user
// @route   GET /api/users/referrals
// @access  Private
exports.getReferralStats = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const referredFriends = await User.find({ referredBy: user._id })
      .select('firstName lastName email createdAt hasMadeFirstOrder')
      .sort({ createdAt: -1 });

    res.json({
      referralCode: user.referralCode,
      referralEarnings: user.referralEarnings,
      referredFriends
    });
  } catch (error) {
    console.error("Referral Stats Error:", error);
    res.status(500).json({ message: "Failed to fetch referral data" });
  }
};

// @desc    Get all abandoned carts (Admin)
// @route   GET /api/users/admin/abandoned-carts
// @access  Private/Admin
exports.getAbandonedCarts = async (req, res) => {
  try {
    // Users with items in cart who haven't updated in 2+ hours
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const abandonedCarts = await User.find({
      'cart.0': { $exists: true }, // Cart is not empty
      updatedAt: { $lt: twoHoursAgo }
    }).select('firstName lastName email cart updatedAt abandonedCartEmailSentAt');

    res.json(abandonedCarts);
  } catch (error) {
    console.error("Abandoned Cart Fetch Error:", error);
    res.status(500).json({ message: "Failed to fetch abandoned carts" });
  }
};

// @desc    Send nudge notification to user with abandoned cart
// @route   POST /api/users/admin/nudge/:id
// @access  Private/Admin
exports.sendCartNudge = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const Notification = require('../models/Notification');

    // Create notification
    await Notification.create({
      user: user._id,
      title: "🎁 Don't miss out on your favorites!",
      message: `Hi ${user.firstName}, you still have ${user.cart.length} items waiting in your bag. Complete your purchase now before they sell out!`,
      type: 'promo',
      data: { url: '/cart' }
    });

    // Update timestamp to prevent spamming
    user.abandonedCartEmailSentAt = new Date();
    await user.save();

    res.json({ message: "Nudge sent successfully" });
  } catch (error) {
    console.error("Nudge Error:", error);
    res.status(500).json({ message: "Failed to send nudge" });
  }
};

// @desc    Get recently viewed products
// @route   GET /api/users/recently-viewed
// @access  Private
exports.getRecentlyViewed = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('recentlyViewed');
    if (!user) return res.status(404).json({ message: "User not found" });

    // recentlyViewed is already sorted (newest at position 0) and sliced to max 20
    const history = user.recentlyViewed || [];
    const productIds = history.map(item => item.product).slice(0, 10);

    const products = await Product.find({ _id: { $in: productIds } })
      .select('name slug image price category');

    // Sort products back into the history order
    const orderedProducts = productIds.map(id => products.find(p => p._id.toString() === id.toString())).filter(p => p);

    res.json(orderedProducts);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch viewed history" });
  }
};
// @desc    Send OTP to user for security actions
// @route   POST /api/users/send-otp
// @access  Private
exports.sendOTP = async (req, res) => {
  try {
    logger.info("--- SECURITY OTP REQUEST ---");
    logger.info("User ID from req.user: %s", req.user?._id);

    const user = await User.findById(req.user._id);
    if (!user) {
      logger.error("Error: User not found in DB for ID: %s", req.user?._id);
      return res.status(404).json({ message: "User not found" });
    }
    logger.info("User found for OTP: %s", user.email);

    // Generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.otp = otp;
    user.otpExpires = otpExpires;
    await user.save();
    logger.info("OTP saved to User document for: %s", user.email);

    const sendEmail = require('../utils/sendEmail');
    logger.info("Calling sendEmail utility for: %s", user.email);

    try {
      await sendEmail({
        email: user.email,
        subject: "Your Security Verification Code - SLOOK",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px;">
            <h2 style="text-align: center; color: #000;">Verification Code</h2>
            <p>Hello ${user.firstName},</p>
            <p>You requested a security verification code to update your password. Please use the following code:</p>
            <div style="background: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px;">
              ${otp}
            </div>
            <p>This code will expire in 10 minutes.</p>
            <p>If you did not request this, please ignore this email.</p>
            <hr />
            <p style="font-size: 10px; color: #777; text-align: center;">SLOOK - Premium Streetwear Hub</p>
          </div>
        `
      });
      logger.info("Email sent successfully according to sendEmail utility for: %s", user.email);
    } catch (emailError) {
      logger.error("sendEmail UTILITY FAILED: %o", emailError);
      throw emailError; // Re-throw to be caught by outer catch
    }

    res.json({ message: "Verification code sent to your email" });
  } catch (error) {
    logger.error("SEND OTP ERROR DETAIL: %o", error);
    res.status(500).json({ message: "Failed to send verification code: " + error.message });
  }
};

// @desc    Verify OTP (Independent check if needed)
// @route   POST /api/users/verify-otp
// @access  Private
exports.verifyOTP = async (req, res) => {
  try {
    const { otp } = req.body;
    const user = await User.findById(req.user._id);

    if (!user.otp || user.otp !== otp || user.otpExpires < Date.now()) {
      return res.status(400).json({ message: "Invalid or expired verification code" });
    }

    res.json({ message: "Code verified successfully" });
  } catch (error) {
    res.status(500).json({ message: "Verification failed" });
  }
};

// @desc    Get loyalty points history
// @route   GET /api/users/loyalty-history
// @access  Private
exports.getLoyaltyHistory = async (req, res) => {
  try {
    const LoyaltyTransaction = require('../models/LoyaltyTransaction');
    const User = require('../models/User');

    // Use the optimized sync helper
    const healed = await syncUserLoyalty(req.user._id);
    if (!healed) return res.status(404).json({ message: 'User not found' });

    const allTx = await LoyaltyTransaction.find({ user: req.user._id }).sort({ createdAt: -1 });
    const correctedBalance = healed.loyaltyPoints;
    const trueTotalSpent = healed.totalSpent;

    // --- STEP 4: AUTO-EXPIRY CHECK (only if there's a real positive balance) ---
    if (correctedBalance > 0) {
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const lastEarnTx = allTx.find(tx => ['earn', 'bonus', 'referral'].includes(tx.type));

      if (lastEarnTx && new Date(lastEarnTx.createdAt) < ninetyDaysAgo) {
        const recentExpiry = allTx.find(tx => tx.type === 'expire' && new Date(tx.createdAt) >= ninetyDaysAgo);
        if (!recentExpiry) {
          await LoyaltyTransaction.create({
            user: req.user._id,
            type: 'expire',
            amount: correctedBalance,
            description: `${correctedBalance} coins expired due to 90 days of inactivity`,
            referenceModel: 'User',
            referenceId: req.user._id,
            isExpired: true
          });
          await User.updateOne({ _id: req.user._id }, { $set: { loyaltyPoints: 0 } });
          // Re-fetch fresh history after expiry
          const freshTx = await LoyaltyTransaction.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50);
          return res.json({ transactions: freshTx, loyaltyPoints: 0, totalSpent: trueTotalSpent });
        }
      }
    }

    // Return history + corrected balance so frontend can use it directly
    const history = allTx.slice(0, 50);
    res.json({ transactions: history, loyaltyPoints: correctedBalance, totalSpent: trueTotalSpent });

  } catch (error) {
    console.error('Loyalty History Error:', error);
    res.status(500).json({ message: 'Failed to fetch loyalty history' });
  }
};

// @desc    Update user avatar
// @route   POST /api/users/profile/avatar
// @access  Private
exports.updateAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // 1. Cleanup old custom avatar if exists
    if (user.avatar && user.avatar.includes('cloudinary.com')) {
      const oldPublicId = extractPublicId(user.avatar);
      if (oldPublicId) {
        deleteFromCloudinary(oldPublicId).catch(err => console.error("Cloudinary Delete Error (Avatar):", err));
      }
    }

    // 2. Upload new avatar
    const result = await uploadToCloudinary(req.file.buffer, 'avatars');
    
    // 3. Update User
    user.avatar = result.secure_url;
    await user.save();

    res.json({
      message: 'Avatar updated successfully',
      avatar: user.avatar
    });
  } catch (error) {
    console.error('Update Avatar Error:', error);
    res.status(500).json({ message: 'Failed to update avatar' });
  }
};

// @desc    Update user coins (Admin)
// @route   PUT /api/users/:id/coins
// @access  Private/Admin
exports.updateUserCoins = async (req, res) => {
  try {
    const { amount, type, description } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const LoyaltyTransaction = require('../models/LoyaltyTransaction');

    // Create transaction
    await LoyaltyTransaction.create({
      user: user._id,
      type: type || 'bonus', // 'earn', 'spend', 'bonus', 'refund', 'expire'
      amount: Math.abs(amount),
      description: description || 'Admin adjustment',
      referenceModel: 'User',
      referenceId: req.user._id // Admin who performed the action
    });

    // Update user balance
    if (type === 'spend' || type === 'expire') {
      user.loyaltyPoints = Math.max(0, user.loyaltyPoints - Math.abs(amount));
    } else {
      user.loyaltyPoints += Math.abs(amount);
    }

    await user.save();
    res.json({ message: 'Coins updated successfully', loyaltyPoints: user.loyaltyPoints });
  } catch (error) {
    console.error("ADMIN COIN UPDATE ERROR:", error);
    res.status(500).json({ message: 'Failed to update coins' });
  }
};

// @desc    Get all loyalty transactions (Admin)
// @route   GET /api/users/admin/loyalty-transactions
// @access  Private/Admin
exports.getAllLoyaltyTransactions = async (req, res) => {
  try {
    const LoyaltyTransaction = require('../models/LoyaltyTransaction');
    const pageSize = Number(req.query.pageSize) || 20;
    const page = Number(req.query.page) || 1;

    const count = await LoyaltyTransaction.countDocuments();
    const transactions = await LoyaltyTransaction.find()
      .populate('user', 'firstName lastName email')
      .limit(pageSize)
      .skip(pageSize * (page - 1))
      .sort({ createdAt: -1 });

    res.json({
      transactions,
      page,
      pages: Math.ceil(count / pageSize),
      total: count
    });
  } catch (error) {
    console.error("ADMIN COIN HISTORY ERROR:", error);
    res.status(500).json({ message: 'Failed to fetch transactions' });
  }
};


