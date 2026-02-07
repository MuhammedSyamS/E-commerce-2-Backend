const User = require('../models/User');

// --- 1. ADD TO CART ---
const addToCart = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const user = await User.findById(req.user._id);

    const itemIndex = user.cart.findIndex(item => {
      const sameId = item.product.toString() === productId;
      // Compare Variants
      const sameVariant = JSON.stringify(item.selectedVariant) === JSON.stringify(req.body.selectedVariant);
      return sameId && sameVariant;
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
        selectedVariant: req.body.selectedVariant // Save Variant
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
    const { productId } = req.body;
    const user = await User.findById(req.user._id);
    const existingItem = user.cart.find(item => item.product.toString() === productId);

    if (existingItem) {
      if (existingItem.quantity > 1) {
        existingItem.quantity -= 1;
      } else {
        user.cart = user.cart.filter(item => item.product.toString() !== productId);
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
    const user = await User.findById(req.user._id);
    user.cart = user.cart.filter(item => item.product.toString() !== req.params.id);
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