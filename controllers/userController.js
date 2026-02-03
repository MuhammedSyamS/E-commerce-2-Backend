const User = require('../models/User');

// @desc    Toggle product in wishlist
// @route   POST /api/users/wishlist
// @access  Private
exports.toggleWishlist = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const { productId } = req.body;

    if (!user) return res.status(404).json({ message: "User not found" });

    // Check if product is already in wishlist
    const isAdded = user.wishlist.includes(productId);

    if (isAdded) {
      // Remove it
      user.wishlist = user.wishlist.filter((id) => id.toString() !== productId);
    } else {
      // Add it
      user.wishlist.push(productId);
    }

    await user.save();
    res.status(200).json(user.wishlist);
  } catch (error) {
    res.status(500).json({ message: error.message });
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
      { new: true }
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(201).json(user.addresses);
  } catch (error) {
    console.error("ADD ADDRESS ERROR:", error);
    res.status(500).json({ message: "Failed to add address: " + error.message });
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
      { new: true }
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
      user.password = req.body.password;
    }

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      email: updatedUser.email,
      phone: updatedUser.phone,
      isAdmin: updatedUser.isAdmin,
      token: req.headers.authorization.split(' ')[1],
      addresses: updatedUser.addresses,
      wishlist: updatedUser.wishlist,
      cart: updatedUser.cart
    });
  } catch (error) {
    console.error("UPDATE ERROR:", error);
    res.status(500).json({ message: error.message || "Update failed" });
  }
};

// @desc    Get user profile (Sync/Fresh Data)
// @route   GET /api/users/profile
// @access  Private
exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      isAdmin: user.isAdmin,
      role: user.role, // Added Role
      permissions: user.permissions, // Added Permissions
      // We don't generate a new token here, just return data. 
      // The client keeps the old valid token but updates the user object.
      addresses: user.addresses,
      wishlist: user.wishlist,
      cart: user.cart,
      notifications: user.notifications,
      savedCards: user.savedCards
    });
  } catch (error) {
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
    res.json(user.notifications ? user.notifications.reverse() : []);
  } catch (error) {
    res.status(500).json({ message: "Fetch failed" });
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
      { new: true }
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
      { new: true }
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
    const users = await User.find({});
    res.json(users);
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
    console.log(`UPDATE ROLE REQUEST for ${req.params.id}:`, req.body);
    // 1. Fetch user for checks (Protection Logic)
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    let update = {};

    // Update role if provided
    if (req.body.role) {
      const newRole = req.body.role;

      // PROTECTION: Prevent removing the last admin
      if (user.role === 'admin' && newRole !== 'admin') {
        const adminCount = await User.countDocuments({ role: 'admin' });
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
    const updatedUser = await User.findByIdAndUpdate(req.params.id, update, { new: true });

    console.log("User updated successfully:", updatedUser.role, updatedUser.permissions);
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