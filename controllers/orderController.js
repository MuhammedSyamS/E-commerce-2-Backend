const Order = require('../models/Order');

exports.addOrderItems = async (req, res) => {
  try {
    const { orderItems, shippingAddress, paymentMethod, totalPrice } = req.body;

    if (!orderItems || orderItems.length === 0) {
      return res.status(400).json({ message: 'No order items provided' });
    }

    // MAP FIELDS EXPLICITLY TO MATCH YOUR SCHEMA
    const order = new Order({
      user: req.user._id,
      orderItems: orderItems.map(item => ({
        name: item.name,
        qty: item.qty || item.quantity, // Handle both naming conventions
        image: item.image,
        price: item.price,
        product: item.product
      })),
      shippingAddress: {
        address: shippingAddress.address,
        city: shippingAddress.city,
        postalCode: shippingAddress.postalCode || shippingAddress.zip, // Fix: support both names
        phone: shippingAddress.phone
      },
      paymentMethod,
      totalPrice,
      isPaid: paymentMethod === 'cod' ? false : true,
      paidAt: paymentMethod === 'cod' ? null : Date.now(),
    });

    const createdOrder = await order.save();
    res.status(201).json(createdOrder);
  } catch (error) {
    console.error("ORDER ERROR:", error.message); // Look at your terminal!
    res.status(500).json({ message: "Database rejected the order", error: error.message });
  }
};

exports.getMyOrders = async (req, res) => {
  try {
    // Ensure we are searching by the authenticated user's ID
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ message: "Error fetching orders", error: error.message });
  }
};