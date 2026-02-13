const User = require('../models/User');

exports.toggleWishlist = async (req, res) => {
  try {
    // 1. Fetch User (No populate yet to add/remove ID)
    let user = await User.findById(req.user._id);
    const { productId } = req.body;

    if (!productId) return res.status(400).json({ message: "Product ID required" });

    const isWishlisted = user.wishlist.some(id => id.toString() === productId.toString());

    if (isWishlisted) {
      user.wishlist = user.wishlist.filter(id => id.toString() !== productId.toString());
    } else {
      user.wishlist.push(productId);
    }

    await user.save();

    // 2. CLEANSING STEP: Populate to check for dead IDs
    user = await User.findById(req.user._id).populate('wishlist');

    // Filter out nulls (products deleted from DB but ref exists)
    const validWishlist = user.wishlist.filter(item => item !== null);

    // If we found dead items, update DB immediately
    if (validWishlist.length !== user.wishlist.length) {
      // We must accept that we just saved the user, but now we detected rot.
      // We update the list to only valid IDs
      await User.updateOne(
        { _id: req.user._id },
        { wishlist: validWishlist.map(p => p._id) }
      );
    }

    // Return the CLEANED, POPULATED array
    // This ensures frontend has valid data immediately and badge count is correct
    res.status(200).json(validWishlist);

  } catch (error) {
    console.error("Wishlist Toggle Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.getWishlist = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('wishlist');

    // Filter out nulls (deleted products)
    const validWishlist = user.wishlist.filter(item => item !== null);

    // Optional: If length changed, update DB to remove dead IDs
    if (validWishlist.length !== user.wishlist.length) {
      await User.updateOne(
        { _id: req.user._id },
        { wishlist: validWishlist.map(p => p._id) }
      );
    }

    res.status(200).json(validWishlist);
  } catch (error) {
    res.status(500).json({ message: "Error fetching wishlist" });
  }
};