const User = require('../models/User');

// Helper to compare variants (Size/Color)
const isSameVariant = (v1, v2) => {
  if (!v1 && !v2) return true;
  if (!v1 || !v2) return false;
  return v1.size === v2.size && v1.color === v2.color;
};

// --- 1. ADD TO CART ---
const addToCart = async (req, res) => {
  try {
    const { productId, quantity, selectedVariant } = req.body;
    const user = await User.findById(req.user._id);

    const itemIndex = user.cart.findIndex(item => {
      return item.product.toString() === productId && isSameVariant(item.selectedVariant, selectedVariant);
    });

    if (itemIndex > -1) {
      user.cart[itemIndex].quantity += quantity || 1;
    } else {
      user.cart.push({
        product: productId,
        name: req.body.name,
        price: req.body.price,
        image: req.body.image,
        quantity: quantity || 1,
        selectedVariant: selectedVariant
      });
    }

    await user.save();
    res.status(200).json(user.cart);
  } catch (error) {
    res.status(500).json({ message: "Add failed", error: error.message });
  }
};

// --- 2. DECREASE QUANTITY ---
const decreaseQuantity = async (req, res) => {
  try {
    const { productId, selectedVariant } = req.body;
    const user = await User.findById(req.user._id);

    const itemIndex = user.cart.findIndex(item => {
      return item.product.toString() === productId && isSameVariant(item.selectedVariant, selectedVariant);
    });

    if (itemIndex > -1) {
      if (user.cart[itemIndex].quantity > 1) {
        user.cart[itemIndex].quantity -= 1;
      } else {
        user.cart.splice(itemIndex, 1);
      }
      await user.save();
    }
    res.status(200).json(user.cart);
  } catch (error) {
    res.status(500).json({ message: "Decrease failed", error: error.message });
  }
};

// --- 3. REMOVE FROM CART ---
const removeFromCart = async (req, res) => {
  try {
    const { productId, selectedVariant, _id } = req.body; // _id is the Cart Item Subdocument ID
    const user = await User.findById(req.user._id);

    if (_id) {
      // ROBUST DELETE: Remove by unique Cart Item ID
      user.cart = user.cart.filter(item => item._id.toString() !== _id);
    } else {
      // LEGACY FALLBACK: Remove by Product ID + Variant
      user.cart = user.cart.filter(item => {
        const isTarget = item.product.toString() === productId && isSameVariant(item.selectedVariant, selectedVariant);
        return !isTarget;
      });
    }

    await user.save();
    res.status(200).json(user.cart);
  } catch (error) {
    res.status(500).json({ message: "Remove failed", error: error.message });
  }
};

// --- 4. CLEAR CART ---
const clearCart = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.cart = [];
    await user.save();
    res.status(200).json(user.cart);
  } catch (error) {
    res.status(500).json({ message: "Clear failed", error: error.message });
  }
};


// --- 5. SAVE FOR LATER ---
const saveForLater = async (req, res) => {
  try {
    const { productId, selectedVariant, _id } = req.body;
    const user = await User.findById(req.user._id);

    // Find the item in cart
    let cartItem;
    if (_id) {
      cartItem = user.cart.id(_id);
    } else {
      cartItem = user.cart.find(item =>
        item.product.toString() === productId && isSameVariant(item.selectedVariant, selectedVariant)
      );
    }

    if (!cartItem) {
      return res.status(404).json({ message: "Item not found in cart" });
    }

    // Add to savedForLater (check for duplicates)
    const alreadySaved = user.savedForLater.find(item =>
      item.product.toString() === cartItem.product.toString() && isSameVariant(item.selectedVariant, cartItem.selectedVariant)
    );

    if (!alreadySaved) {
      user.savedForLater.push({
        product: cartItem.product,
        name: cartItem.name,
        price: cartItem.price,
        image: cartItem.image,
        quantity: cartItem.quantity,
        selectedVariant: cartItem.selectedVariant
      });
    }

    // Remove from cart
    if (_id) {
      user.cart.pull(_id);
    } else {
      user.cart = user.cart.filter(item => !(item.product.toString() === productId && isSameVariant(item.selectedVariant, selectedVariant)));
    }

    await user.save();
    res.status(200).json({ cart: user.cart, savedForLater: user.savedForLater });
  } catch (error) {
    res.status(500).json({ message: "Save for later failed", error: error.message });
  }
};

// --- 6. MOVE TO CART ---
const moveToCart = async (req, res) => {
  try {
    const { productId, selectedVariant, _id } = req.body;
    const user = await User.findById(req.user._id);

    // Find the item in savedForLater
    let savedItem;
    if (_id) {
      savedItem = user.savedForLater.id(_id);
    } else {
      savedItem = user.savedForLater.find(item =>
        item.product.toString() === productId && isSameVariant(item.selectedVariant, selectedVariant)
      );
    }

    if (!savedItem) {
      return res.status(404).json({ message: "Item not found in Saved for Later" });
    }

    // Add back to cart (check for duplicates)
    const itemIndex = user.cart.findIndex(item =>
      item.product.toString() === savedItem.product.toString() && isSameVariant(item.selectedVariant, savedItem.selectedVariant)
    );

    if (itemIndex > -1) {
      user.cart[itemIndex].quantity += savedItem.quantity || 1;
    } else {
      user.cart.push({
        product: savedItem.product,
        name: savedItem.name,
        price: savedItem.price,
        image: savedItem.image,
        quantity: savedItem.quantity || 1,
        selectedVariant: savedItem.selectedVariant
      });
    }

    // Remove from savedForLater
    if (_id) {
      user.savedForLater.pull(_id);
    } else {
      user.savedForLater = user.savedForLater.filter(item => !(item.product.toString() === productId && isSameVariant(item.selectedVariant, selectedVariant)));
    }

    await user.save();
    res.status(200).json({ cart: user.cart, savedForLater: user.savedForLater });
  } catch (error) {
    res.status(500).json({ message: "Move to cart failed", error: error.message });
  }
};

// --- THE EXPORT BLOCK ---

module.exports = {
  addToCart,
  decreaseQuantity,
  removeFromCart,
  clearCart,
  saveForLater,
  moveToCart
};
