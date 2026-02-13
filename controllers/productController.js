const Product = require('../models/Product');
const { logStockChange } = require('../utils/stockUtils');

// Fetch all
// Fetch all (with Search, Filter, Sort)
exports.getProducts = async (req, res) => {
  try {
    const { keyword, category, minPrice, maxPrice, sort } = req.query;

    let query = {};

    // 1. Search Keyword (Name or Description)
    if (keyword) {
      query.$or = [
        { name: { $regex: keyword, $options: 'i' } },
        { description: { $regex: keyword, $options: 'i' } },
        { tags: { $regex: keyword, $options: 'i' } }
      ];
    }

    // 2. Category Filter
    if (category && category !== 'All' && category !== 'undefined') {
      query.category = category;
    }

    // 3. Price Filter
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    // 4. Variant Filters (Size, Color)
    const { size, color } = req.query;
    if (size) {
      query['variants.size'] = size;
    }
    if (color) {
      query['variants.color'] = color;
    }

    // 4. Sorting
    let sortOption = { createdAt: -1 }; // Default: Newest
    if (sort) {
      switch (sort) {
        case 'price-asc':
          sortOption = { price: 1 };
          break;
        case 'price-desc':
          sortOption = { price: -1 };
          break;
        case 'oldest':
          sortOption = { createdAt: 1 };
          break;
        case 'rating':
          sortOption = { rating: -1 };
          break;
        default:
          sortOption = { createdAt: -1 };
      }
    }

    const products = await Product.find(query).sort(sortOption);

    // Debug Log (Optional, remove in production)
    console.log(`GET /products: Found ${products.length} items. Filters:`, { keyword, category, minPrice, maxPrice, sort });

    res.status(200).json(products);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Fetch single product by slug OR ID
// @route   GET /api/products/:slug
// @access  Public
exports.getProductBySlug = async (req, res) => {
  try {
    let product = await Product.findOne({ slug: req.params.slug }).populate('reviews.user', 'name firstName');

    // Fallback: Check by ID if not found by slug (and if valid ObjectId)
    if (!product && require('mongoose').Types.ObjectId.isValid(req.params.slug)) {
      product = await Product.findById(req.params.slug).populate('reviews.user', 'name firstName');
    }

    if (product) {
      res.json(product);
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get AI Recommendations
// @route   GET /api/products/recommendations
// @access  Public (Optional Auth)
exports.getRecommendations = async (req, res) => {
  try {
    let recommendations = [];
    const limit = 4;

    // 1. If User Logged In & Has History
    if (req.user) {
      const User = require('../models/User');
      const user = await User.findById(req.user._id).populate('recentlyViewed.product');

      if (user && user.recentlyViewed.length > 0) {
        // Extract categories and tags from history
        const viewedCategories = user.recentlyViewed
          .map(item => item.product?.category)
          .filter(Boolean);

        // Find products in these categories, excluding already viewed
        const viewedIds = user.recentlyViewed.map(item => item.product?._id);

        if (viewedCategories.length > 0) {
          recommendations = await Product.find({
            category: { $in: viewedCategories },
            _id: { $nin: viewedIds }
          }).limit(limit);
        }
      }
    }

    // 2. Fallback: Best Sellers or New Arrivals if no personal recs
    if (recommendations.length < limit) {
      const fallback = await Product.find({
        _id: { $nin: recommendations.map(p => p._id) },
        isBestSeller: true
      }).limit(limit - recommendations.length);
      recommendations = [...recommendations, ...fallback];
    }

    // 3. Final Fallback: Just get any products
    if (recommendations.length < limit) {
      const filler = await Product.find({
        _id: { $nin: recommendations.map(p => p._id) }
      }).limit(limit - recommendations.length);
      recommendations = [...recommendations, ...filler];
    }

    res.json(recommendations);
  } catch (error) {
    console.error("Recommendation Error:", error);
    res.status(500).json({ message: "Failed to fetch recommendations" });
  }
};

// Create review (Fixes 500 error & Image Upload)
// Create review (Fixes 500 error & Image Upload)
// Create review (Fixes 500 error & Image Upload & Verified Purchase)
exports.createProductReview = async (req, res) => {
  const { rating, comment, images, videos } = req.body; // Changed video to videos
  try {
    let product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    // AGGRESSIVE FIX: Reset reviews if corrupted
    if (!Array.isArray(product.reviews)) {
      await Product.updateOne({ _id: product._id }, { $set: { reviews: [], numReviews: 0, rating: 0 } });
      product = await Product.findById(req.params.id);
    }

    // Check if user already reviewed
    const alreadyReviewed = product.reviews.find(
      (r) => r.user.toString() === req.user._id.toString()
    );

    if (alreadyReviewed) {
      return res.status(400).json({ message: 'Product already reviewed' });
    }

    // --- VERIFIED PURCHASE CHECK ---
    const Order = require('../models/Order');
    // Find any PAID order by this user containing this product
    const verifiedOrder = await Order.findOne({
      user: req.user._id,
      isPaid: true,
      "orderItems.product": product._id
    });
    const isVerified = !!verifiedOrder;
    // -------------------------------

    let userName = req.user.firstName || req.user.name || "User";
    if (req.user.lastName) userName += ` ${req.user.lastName}`;

    const validImages = Array.isArray(images) ? images : [];
    const validVideos = Array.isArray(videos) ? videos : []; // Handle array

    const review = {
      name: userName,
      rating: Number(rating),
      comment,
      images: validImages,
      videos: validVideos, // Store videos array
      user: req.user._id,
      isVerifiedPurchase: isVerified, // AUTO-SET
      helpful: []
    };

    product.reviews.push(review);

    product.numReviews = product.reviews.length;
    product.rating = product.reviews.reduce((acc, item) => item.rating + acc, 0) / product.reviews.length;

    await product.save();
    res.status(201).json({ message: 'Review added successfully' });
  } catch (error) {
    console.error("Review Submission Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Toggle Review Helpful Vote
exports.toggleReviewHelpful = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const review = product.reviews.id(req.params.reviewId);
    if (!review) return res.status(404).json({ message: 'Review not found' });

    // Check if user already found it helpful
    const userId = req.user._id;
    const isHelpful = review.helpful.includes(userId);

    if (isHelpful) {
      // Un-vote
      review.helpful.pull(userId);
    } else {
      // Vote
      review.helpful.push(userId);
    }

    await product.save();
    res.json({ message: 'Vote updated', helpfulCount: review.helpful.length, isHelpful: !isHelpful });
  } catch (error) {
    console.error("Helpful Vote Error:", error);
    res.status(500).json({ message: 'Vote failed' });
  }
};

// Get Public Reviews (All)
exports.getPublicReviews = async (req, res) => {
  try {
    const products = await Product.find({ 'reviews.0': { $exists: true } });
    let allReviews = [];

    products.forEach(product => {
      if (product.reviews && Array.isArray(product.reviews)) {
        product.reviews.forEach(review => {
          if (review.isApproved !== false) { // Only show approved/public reviews
            allReviews.push({
              _id: review._id,
              productName: product.name,
              productSlug: product.slug,
              productImage: product.image,
              review: review
            });
          }
        });
      }
    });

    // Sort by Newest
    allReviews.sort((a, b) => {
      const dateA = new Date(a.review.createdAt || 0);
      const dateB = new Date(b.review.createdAt || 0);
      return dateB - dateA;
    });

    res.json(allReviews);
  } catch (error) {
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
      {
        url: `/product/${createdProduct.slug}`,
        image: createdProduct.image
      }
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
      // CAPTURE OLD STATE
      const oldStock = product.countInStock;
      const oldVariants = product.variants ? product.variants.map(v => v.toObject()) : [];

      product.name = name || product.name;
      product.price = price || product.price;
      product.description = description || product.description;
      product.image = image || product.image;
      product.images = images || product.images;
      product.category = category || product.category;
      product.countInStock = (countInStock !== undefined && countInStock !== '') ? Number(countInStock) : product.countInStock;

      // ... other fields ...
      product.isBestSeller = isBestSeller !== undefined ? isBestSeller : product.isBestSeller;
      product.discountPrice = discountPrice !== undefined ? discountPrice : product.discountPrice;
      product.specs = specs !== undefined ? specs : product.specs;
      product.tags = tags !== undefined ? tags : product.tags;
      product.video = video || product.video;
      product.variants = variants || product.variants;
      product.seo = seo || product.seo;
      product.richDescription = richDescription || product.richDescription;

      const updatedProduct = await product.save();

      // LOG MAIN STOCK CHANGE
      if (oldStock !== updatedProduct.countInStock) {
        logStockChange({
          productId: product._id,
          oldStock: oldStock,
          newStock: updatedProduct.countInStock,
          reason: 'Admin Adjustment',
          referenceId: req.user._id,
          adminId: req.user._id,
          note: `Direct update via Admin Panel`
        });
      }

      // LOG VARIANT CHANGES
      // Heuristic: Match by Size/Color and check stock
      if (updatedProduct.variants && updatedProduct.variants.length > 0) {
        updatedProduct.variants.forEach(newVar => {
          const oldVar = oldVariants.find(ov => ov.size === newVar.size && ov.color === newVar.color);
          if (oldVar) {
            if (oldVar.stock !== newVar.stock) {
              logStockChange({
                productId: product._id,
                variant: { size: newVar.size, color: newVar.color },
                oldStock: oldVar.stock,
                newStock: newVar.stock,
                reason: 'Admin Adjustment',
                referenceId: req.user._id,
                adminId: req.user._id,
                note: `Variant Stock Adjusted`
              });
            }
          } else {
            // New Variant Added (treat old stock as 0)
            logStockChange({
              productId: product._id,
              variant: { size: newVar.size, color: newVar.color },
              oldStock: 0,
              newStock: newVar.stock,
              reason: 'Admin Adjustment',
              referenceId: req.user._id,
              adminId: req.user._id,
              note: `New Variant Created`
            });
          }
        });
      }

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

// @desc    Get Stock Logs for a Product
// @route   GET /api/products/:id/stock-logs
// @access  Private/Admin
exports.getStockLogs = async (req, res) => {
  try {
    const StockLog = require('../models/StockLog');
    const logs = await StockLog.find({ product: req.params.id })
      .populate('adminUser', 'name email firstName')
      .sort({ createdAt: -1 });
    res.json(logs);
  } catch (error) {
    console.error("Stock Log Fetch Error:", error);
    res.status(500).json({ message: "Failed to fetch stock logs" });
  }
};