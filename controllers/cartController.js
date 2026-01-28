const User = require('../models/User');

/**
 * @desc    Add item / Increase quantity
 * @route   POST /api/cart/add
 */
exports.addToCart = async (req, res) => {
  try {
    const { productId, name, price, image } = req.body;
    const user = await User.findById(req.user._id);

    const existingItem = user.cart.find(item => item.product.toString() === productId);

    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      user.cart.push({ product: productId, name, price, image, quantity: 1 });
    }

    await user.save();
    res.status(200).json(user.cart);
  } catch (error) {
    res.status(500).json({ message: "Add failed", error: error.message });
  }
};

/**
 * @desc    Decrease quantity / Remove if 1
 * @route   POST /api/cart/decrease
 */
exports.decreaseQuantity = async (req, res) => {
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

/**
 * @desc    Remove item entirely
 * @route   DELETE /api/cart/remove/:id
 */
exports.removeFromCart = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.cart = user.cart.filter(item => item.product.toString() !== req.params.id);
    await user.save();
    res.status(200).json(user.cart);
  } catch (error) {
    res.status(500).json({ message: "Remove failed", error: error.message });
  }
};

/**
 * @desc    Clear all items
 * @route   DELETE /api/cart/clear
 */
exports.clearCart = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.cart = []; 
    await user.save();
    res.status(200).json(user.cart);
  } catch (error) {
    res.status(500).json({ message: "Clear failed", error: error.message });
  }
};