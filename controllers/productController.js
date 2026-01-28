const Product = require('../models/Product');

/**
 * @desc    Fetch all products with optional category filtering
 * @route   GET /api/products
 * @access  Public
 */
exports.getProducts = async (req, res) => {
  try {
    const { category } = req.query;
    
    // Safety check: if category is 'All', 'undefined', or empty, fetch everything
    let query = {};
    if (category && category !== 'All' && category !== 'undefined') {
      query = { category: category };
    }

    const products = await Product.find(query);
    
    // Log this to your Backend Terminal to verify DB connection
    console.log(`[Database] Found ${products.length} products for category: ${category || 'All'}`);
    
    res.status(200).json(products);
  } catch (error) {
    console.error("Fetch Error:", error.message);
    res.status(500).json({ 
      message: "Error fetching products", 
      error: error.message 
    });
  }
};

/**
 * @desc    Create a new product
 * @route   POST /api/products
 * @access  Private/Admin
 */
exports.createProduct = async (req, res) => {
  try {
    const { name, price, description, image, category, slug, isBestSeller, isNewArrival } = req.body;
    
    const product = new Product({
      name,
      slug, // Ensure slug is sent from frontend or generated
      price,
      description,
      image,
      category,
      isBestSeller,
      isNewArrival
    });

    const createdProduct = await product.save();
    res.status(201).json(createdProduct);
  } catch (error) {
    res.status(400).json({ message: "Invalid product data", error: error.message });
  }
};