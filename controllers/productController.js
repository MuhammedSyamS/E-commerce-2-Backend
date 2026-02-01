const Product = require('../models/Product');

// Fetch all
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
    res.status(500).json({ message: error.message });
  }
};

// Fetch single
exports.getProductBySlug = async (req, res) => {
  try {
    const product = await Product.findOne({
      $or: [
        { slug: req.params.slug },
        { _id: req.params.slug.match(/^[0-9a-fA-F]{24}$/) ? req.params.slug : null }
      ].filter(Boolean)
    }).populate('reviews.user', 'name firstName');

    if (product) res.json(product);
    else res.status(404).json({ message: 'Product not found' });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Create review (Fixes 500 error & Image Upload)
// Create review (Fixes 500 error & Image Upload)
exports.createProductReview = async (req, res) => {
  const { rating, comment, images } = req.body; // Expect images array
  try {
    let product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    // AGGRESSIVE FIX: If reviews is not an array (e.g. legacy data was a number), FORCE RESET IT IN DB
    if (!Array.isArray(product.reviews)) {
      console.log(`Fixing corrupted reviews for product ${product._id}`);
      await Product.updateOne({ _id: product._id }, { $set: { reviews: [], numReviews: 0, rating: 0 } });
      product = await Product.findById(req.params.id); // Reload
    }

    // Check if user already reviewed
    const alreadyReviewed = product.reviews.find(
      (r) => r.user.toString() === req.user._id.toString()
    );

    if (alreadyReviewed) {
      return res.status(400).json({ message: 'Product already reviewed' });
    }

    // Construct Name: "Aditya S." or "Aditya Sharma"
    let userName = req.user.firstName || req.user.name || "User";
    if (req.user.lastName) userName += ` ${req.user.lastName.charAt(0)}.`; // "Aditya S."

    // Limit images to 4
    const validImages = Array.isArray(images) ? images.slice(0, 4) : [];

    const review = {
      name: userName,
      rating: Number(rating),
      comment,
      images: validImages,
      user: req.user._id,
    };

    product.reviews.push(review);

    // Recalculate Stats Immediately
    product.numReviews = product.reviews.length;
    product.rating = product.reviews.reduce((acc, item) => item.rating + acc, 0) / product.reviews.length;

    await product.save();
    res.status(201).json({ message: 'Review added successfully' });
  } catch (error) {
    console.error("Review Submission Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get Featured Reviews (Top rated from all products)
exports.getFeaturedReviews = async (req, res) => {
  try {
    const reviews = await Product.aggregate([
      { $unwind: "$reviews" },
      // { $match: { "reviews.rating": { $gte: 4 } } }, // REMOVED FILTER so all reviews show
      { $sort: { "reviews.createdAt": -1 } }, // Newest first
      { $limit: 12 },
      {
        $project: {
          _id: 0,
          productName: "$name",
          productSlug: "$slug",
          productImage: "$image",
          review: "$reviews"
        }
      }
    ]);
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete review
exports.deleteProductReview = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const review = product.reviews.find(r => r._id.toString() === req.params.reviewId);
    if (!review) return res.status(404).json({ message: 'Review not found' });

    // Check ownership (or admin)
    if (review.user.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(401).json({ message: 'Not authorized to delete this review' });
    }

    // Remove review
    product.reviews = product.reviews.filter(r => r._id.toString() !== req.params.reviewId);

    // Recalculate stats
    product.numReviews = product.reviews.length;
    product.rating = product.reviews.length > 0
      ? (product.reviews.reduce((acc, item) => item.rating + acc, 0) / product.reviews.length)
      : 0;

    await product.save();
    res.status(200).json({ message: 'Review deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Logged In User's Reviews
exports.getUserReviews = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    console.log("API: Fetching reviews for user ID:", userId);

    // 1. Fetch all products that HAVE reviews
    const products = await Product.find({ 'reviews.0': { $exists: true } });

    // 2. Filter manually in JS (Foolproof vs Aggregation types)
    const userReviews = [];

    products.forEach(product => {
      if (product.reviews && Array.isArray(product.reviews)) {
        product.reviews.forEach(review => {
          // Check if this review belongs to user
          // Robust check: handle nulls, strings, objects
          const reviewUserId = review.user ? review.user.toString() : null;

          if (reviewUserId === userId) {
            userReviews.push({
              _id: product._id, // Add Product ID for Delete functionality
              productName: product.name,
              productSlug: product.slug,
              productImage: product.image,
              review: review
            });
          }
        });
      }
    });

    // 3. Sort by Date Newest
    userReviews.sort((a, b) => {
      const dateA = new Date(a.review.createdAt || 0);
      const dateB = new Date(b.review.createdAt || 0);
      return dateB - dateA;
    });

    console.log(`API: Found ${userReviews.length} reviews via JS Filter.`);
    res.json(userReviews);
  } catch (error) {
    console.error("Error fetching user reviews:", error);
    res.status(500).json({ message: error.message });
  }
};