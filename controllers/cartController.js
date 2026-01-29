const User = require('../models/User');

// --- 1. ADD TO CART ---
const addToCart = async (req, res) => {
  try {
    const { productId, name, price, image, quantity } = req.body;
    const qtyToAdd = Number(quantity) || 1;
    const user = await User.findById(req.user._id);

    const existingItem = user.cart.find(item => item.product.toString() === productId);

    if (existingItem) {
      existingItem.quantity += qtyToAdd;
    } else {
      user.cart.push({ product: productId, name, price, image, quantity: qtyToAdd });
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