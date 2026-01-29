const Product = require('../models/Product');

// @desc    Fetch all products
exports.getProducts = async (req, res) => {
  try {
    const { category } = req.query;
    let query = {};
    if (category && category !== 'All' && category !== 'undefined') {
      query = { category };
    }
    const products = await Product.find(query);
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: "Error fetching products", error: error.message });
  }
};

// @desc    Get single product (Fixes the Blank Page issue)
exports.getProductBySlug = async (req, res) => {
  try {
    // This allows the frontend to send either the slug (silver-ring) OR the ID (65a...)
    const product = await Product.findOne({
      $or: [
        { slug: req.params.slug },
        { _id: req.params.slug.match(/^[0-9a-fA-F]{24}$/) ? req.params.slug : null }
      ].filter(Boolean) // Removes null if it's not a valid MongoDB ID format
    });

    if (product) {
      res.json(product);
    } else {
      console.log(`[Backend] Product not found for param: ${req.params.slug}`);
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    console.error("Detail Fetch Error:", error.message);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// @desc    Create new review (Stars, Comment, Image)
exports.createProductReview = async (req, res) => {
  const { rating, comment, reviewImage } = req.body;

  try {
    const product = await Product.findById(req.params.id);

    if (product) {
      const alreadyReviewed = product.reviews.find(
        (r) => r.user.toString() === req.user._id.toString()
      );

      if (alreadyReviewed) {
        return res.status(400).json({ message: 'Product already reviewed' });
      }

      const review = {
        name: req.user.firstName || req.user.name,
        rating: Number(rating),
        comment,
        reviewImage, // URL of the photo uploaded by user
        user: req.user._id,
      };

      product.reviews.push(review);
      product.numReviews = product.reviews.length;
      
      // Dynamic Average Rating Calculation
      product.rating = product.reviews.reduce((acc, item) => item.rating + acc, 0) / product.reviews.length;

      await product.save();
      res.status(201).json({ message: 'Review added successfully' });
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createProductReview = async (req, res) => {
  const { rating, comment, reviewImage } = req.body;

  try {
    const product = await Product.findById(req.params.id);

    if (!product) return res.status(404).json({ message: 'Product not found' });

    // 1. Create the Review OBJECT
    const review = {
      name: req.user.firstName || req.user.name,
      rating: Number(rating),
      comment: comment,
      reviewImage: reviewImage || "",
      user: req.user._id,
    };

    // 2. Push the OBJECT into the reviews array (Don't set product.reviews = rating!)
    product.reviews.push(review);

    // 3. Update the metadata
    product.numReviews = product.reviews.length;
    product.rating = product.reviews.reduce((acc, item) => item.rating + acc, 0) / product.reviews.length;

    await product.save();
    res.status(201).json({ message: 'Review added successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};