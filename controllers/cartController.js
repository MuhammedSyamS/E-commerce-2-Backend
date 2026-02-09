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

// --- THE EXPORT BLOCK ---
module.exports = {
  addToCart,
  decreaseQuantity,
  removeFromCart,
  clearCart
};