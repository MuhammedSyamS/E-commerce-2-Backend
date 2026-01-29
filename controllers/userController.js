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