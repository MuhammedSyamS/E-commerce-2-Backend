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
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const newAddress = req.body; // Expects { label, street, city, ... }

    // If set as default, unset others // logic could be added here

    user.addresses.push(newAddress);
    await user.save();

    res.status(201).json(user.addresses);
  } catch (error) {
    res.status(500).json({ message: "Failed to add address" });
  }
};

// @desc    Remove an address
// @route   DELETE /api/users/addresses/:id
// @access  Private
exports.removeAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.addresses = user.addresses.filter(addr => addr._id.toString() !== req.params.id);
    await user.save();

    res.status(200).json(user.addresses);
  } catch (error) {
    res.status(500).json({ message: "Failed to delete address" });
  }
};

// @desc    Update basic profile
// @route   PUT /api/users/profile
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.firstName = req.body.firstName || user.firstName;
    user.lastName = req.body.lastName || user.lastName;

    if (req.body.password) {
      user.password = req.body.password; // pre-save hook handles hashing
    }

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      email: updatedUser.email,
      isAdmin: updatedUser.isAdmin,
      token: req.headers.authorization.split(' ')[1], // reuse existing token
      addresses: updatedUser.addresses,
      wishlist: updatedUser.wishlist,
      cart: updatedUser.cart
    });
  } catch (error) {
    res.status(500).json({ message: "Update failed" });
  }
};

// @desc    Get user notifications
// @route   GET /api/users/notifications
// @access  Private
exports.getNotifications = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Mock if empty for demo
    if (user.notifications.length === 0) {
      return res.json([
        { _id: '1', title: "Welcome!", message: "Welcome to Highphaus!", type: "system", isRead: false, createdAt: new Date() }
      ]);
    }

    res.json(user.notifications.reverse());
  } catch (error) {
    res.status(500).json({ message: "Fetch failed" });
  }
};