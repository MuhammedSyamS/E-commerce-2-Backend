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
    console.log(`DEBUG: Sending ${products.length} products. Sample Stock:`, products.slice(0, 3).map(p => ({ name: p.name, stock: p.countInStock })));
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
    if (req.user.lastName) userName += ` ${req.user.lastName}`; // "Aditya Sharma"

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

    console.log("Saving review to DB...", review);
    const savedProduct = await product.save();
    console.log("Review saved! Total reviews now:", savedProduct.reviews.length);

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

// Toggle Review Visibility
exports.toggleReviewVisibility = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    const review = product.reviews.id(req.params.reviewId);

    if (review) {
      review.isApproved = !review.isApproved;
      await product.save();
      res.json({ message: 'Review visibility updated', isApproved: review.isApproved });
    } else {
      res.status(404).json({ message: 'Review not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Update failed' });
  }
};

// Reply to Review
exports.replyToReview = async (req, res) => {
  const { response } = req.body;
  try {
    const product = await Product.findById(req.params.id);
    const review = product.reviews.id(req.params.reviewId);

    if (review) {
      review.adminResponse = response;
      await product.save();
      res.json({ message: 'Reply posted', adminResponse: response });
    } else {
      res.status(404).json({ message: 'Review not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Reply failed' });
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

// --- ADMIN CONTROLLERS ---

// @desc    Create a product
// @route   POST /api/products
// @access  Private/Admin
// @desc    Create a product
// @route   POST /api/products
// @access  Private/Admin
exports.createProduct = async (req, res) => {
  console.log("CREATE PRODUCT REQUEST:", req.body);
  console.log("USER:", req.user);

  try {

    const { name, price, category, subcategory, image, images, description, richDescription, isBestSeller, countInStock, discountPrice, specs, tags, video, variants, seo } = req.body;

    if (!name) return res.status(400).json({ message: "Product Name is required" });
    if (!price) return res.status(400).json({ message: "Price is required" });
    if (!category) return res.status(400).json({ message: "Category is required" });

    // Generate slug from name
    const slugRaw = name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
    const slug = slugRaw || 'product'; // Fallback if name is all special chars

    const product = new Product({
      name,
      slug: slug + '-' + Date.now().toString().slice(-4), // Ensure uniqueness
      price,
      // user: req.user._id, // Removed strict user dependency if schema doesn't have it, or keep if implicit
      image,
      images: images || [],
      category,
      subcategory,
      countInStock: (countInStock !== undefined && countInStock !== '') ? Number(countInStock) : 0,
      discountPrice: discountPrice || 0,
      numReviews: 0,
      description,
      richDescription, // NEW
      specs: specs || [],
      tags: tags || [],
      // NEW ADVANCED FIELDS
      video,
      variants: variants || [],
      seo: seo || {},
      isBestSeller: isBestSeller || false
    });

    const createdProduct = await product.save();
    console.log("PRODUCT CREATED SUCCESSFULLY:", createdProduct._id);

    // --- TRIGGER PUSH NOTIFICATION ---
    const pushUtils = require('../utils/push');
    // Don't await strictly to avoid blocking response
    pushUtils.sendToAll(
      "New Drop Alert!",
      `Check out our latest arrival: ${createdProduct.name}`,
      { url: `/product/${createdProduct.slug}` }
    );

    res.status(201).json(createdProduct);
  } catch (error) {
    console.error("Create Product Error:", error);
    res.status(500).json({ message: "Product creation failed: " + error.message });
  }
};

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private/Admin
exports.updateProduct = async (req, res) => {
  try {
    const { name, price, description, richDescription, image, images, category, subcategory, countInStock, isBestSeller, discountPrice, specs, tags, video, variants, seo } = req.body;
    const product = await Product.findById(req.params.id);

    if (product) {
      product.name = name || product.name;
      product.price = price || product.price;
      product.description = description || product.description;
      product.image = image || product.image;
      product.images = images || product.images;
      product.category = category || product.category;
      product.countInStock = (countInStock !== undefined && countInStock !== '') ? Number(countInStock) : product.countInStock;
      product.isBestSeller = isBestSeller !== undefined ? isBestSeller : product.isBestSeller;
      product.discountPrice = discountPrice !== undefined ? discountPrice : product.discountPrice;
      product.specs = specs !== undefined ? specs : product.specs;
      product.tags = tags !== undefined ? tags : product.tags;
      // NEW
      product.video = video || product.video;
      product.variants = variants || product.variants;
      product.seo = seo || product.seo;
      product.richDescription = richDescription || product.richDescription;

      const updatedProduct = await product.save();
      res.json(updatedProduct);
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    res.status(500).json({ message: "Product update failed" });
  }
};

// @desc    Get all reviews (Admin)
// @route   GET /api/products/admin/reviews
// @access  Private/Admin
exports.getAllReviews = async (req, res) => {
  try {
    const products = await Product.find({ 'reviews.0': { $exists: true } });
    console.log(`ADMIN REVIEWS: Found ${products.length} products with reviews.`);

    let allReviews = [];

    products.forEach(product => {
      if (product.reviews && Array.isArray(product.reviews)) {
        product.reviews.forEach(review => {
          allReviews.push({
            _id: product._id, // Product ID needed for deletion
            productName: product.name,
            productImage: product.image,
            review: review
          });
        });
      }
    });

    console.log(`ADMIN REVIEWS: Total reviews aggregated: ${allReviews.length}`);

    // Sort by Newest
    allReviews.sort((a, b) => {
      const dateA = new Date(a.review.createdAt || 0);
      const dateB = new Date(b.review.createdAt || 0);
      return dateB - dateA;
    });

    res.json(allReviews);
  } catch (error) {
    console.error("ADMIN REVIEWS ERROR:", error);
    res.status(500).json({ message: "Failed to fetch reviews" });
  }
};

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Private/Admin
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (product) {
      await Product.deleteOne({ _id: product._id });
      res.json({ message: 'Product removed' });
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    res.status(500).json({ message: "Product deletion failed" });
  }
};