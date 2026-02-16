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

exports.getSharedWishlist = async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`[DEBUG] getSharedWishlist called with userId: '${userId}'`);

    // Validate ID format
    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      console.log(`[DEBUG] Invalid ID format`);
      return res.status(404).json({ message: "Invalid User ID" });
    }

    const user = await User.findById(userId).populate('wishlist');

    if (!user) {
      console.log(`[DEBUG] User not found in DB`);
      return res.status(404).json({ message: "Wishlist not found" });
    }

    // Filter out nulls
    const validWishlist = user.wishlist.filter(item => item !== null);

    // Public: Return only necessary product info (security)
    // Actually, populate returns full product doc. That's fine for public products.
    res.status(200).json(validWishlist);
  } catch (error) {
    console.error("Shared Wishlist Error:", error);
    res.status(500).json({ message: "Error loading shared wishlist" });
  }
};
