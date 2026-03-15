const Product = require('../models/Product');
const { logStockChange } = require('../utils/stockUtils');
const logger = require('../utils/logger');
const { deleteFromCloudinary, extractPublicId } = require('../utils/cloudinary');

exports.searchProducts = async (req, res) => {
  try {
    const { keyword } = req.query;
    if (!keyword) return res.json({ products: [], categories: [] });

    // 1. Search Products
    const products = await Product.find({
      $or: [
        { name: { $regex: keyword, $options: 'i' } },
        { description: { $regex: keyword, $options: 'i' } },
        { tags: { $regex: keyword, $options: 'i' } }
      ]
    })
      .select('name slug image price category tags isNewArrival isBestSeller rating numReviews')
      .limit(30)
      .lean();

    const scoredProducts = products.map(p => {
      let score = 0;
      if (p.name.toLowerCase().includes(keyword.toLowerCase())) score += 10;
      if (p.description?.toLowerCase().includes(keyword.toLowerCase())) score += 5;
      if (p.tags && p.tags.some(t => t.toLowerCase().includes(keyword.toLowerCase()))) score += 3;
      return { ...p, searchScore: score };
    }).sort((a, b) => b.searchScore - a.searchScore).slice(0, 5);

    // 2. Extract Matching Categories
    const categories = await Product.distinct('category', {
      category: { $regex: keyword, $options: 'i' }
    });

    res.json({
      products: scoredProducts,
      categories: categories.slice(0, 3)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getProducts = async (req, res) => {
  try {
    const {
      keyword, category, subcategory,
      minPrice, maxPrice, sort,
      size, color, minRating, minDiscount,
      isNewArrival, isBestSeller, inStock, isFlashSale
    } = req.query;

    let query = {};

    // 1. Search Keyword
    if (keyword) {
      query.$or = [
        { name: { $regex: keyword, $options: 'i' } },
        { description: { $regex: keyword, $options: 'i' } },
        { tags: { $regex: keyword, $options: 'i' } }
      ];
    }

    // 2. Category & Subcategory
    if (category && category !== 'All' && category !== 'undefined') {
      query.category = category;
    }
    if (subcategory && subcategory !== 'All' && subcategory !== 'undefined') {
      query.subcategory = subcategory;
    }

    // 3. Price Filter
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    // 4. Variant Filters
    if (size) query['variants.size'] = size;
    if (color) query['variants.color'] = color;

    // 5. Special Flags
    if (isNewArrival === 'true') query.isNewArrival = true;
    if (isBestSeller === 'true') query.isBestSeller = true;
    if (isFlashSale === 'true') query.isFlashSale = true;
    if (inStock === 'true') query.countInStock = { $gt: 0 };

    // 6. Discount Filter (Calculated or Flag)
    if (minDiscount) {
      const discountVal = Number(minDiscount);
      // If we have a discountPrice, we check if (price - discountPrice)/price * 100 >= minDiscount
      // Since MongoDB can't easily do this calc on the fly without aggregation if we want it efficient,
      // we check if discountPrice > 0 and basically filter products that have a discount.
      // For specific percentage, normally we'd store discountPercentage in the model.
      // For now, let's filter products where discountPrice exists and is > 0
      query.discountPrice = { $gt: 0 };
    }

    // 5.1 Dynamic Specs (spec_Key=Value)
    Object.keys(req.query).forEach(key => {
      if (key.startsWith('spec_')) {
        const specKey = key.replace('spec_', '');
        const specValue = req.query[key];
        
        // Match in specs array
        if (!query.$and) query.$and = [];
        query.$and.push({
          specs: { $elemMatch: { key: specKey, value: specValue } }
        });
      }
    });

    // 6. Rating Filter
    if (minRating) {
      query.rating = { $gte: Number(minRating) };
    }

    // 7. Sorting
    let sortOption = { createdAt: -1 };
    if (sort) {
      switch (sort) {
        case 'price-asc': sortOption = { price: 1 }; break;
        case 'price-desc': sortOption = { price: -1 }; break;
        case 'oldest': sortOption = { createdAt: 1 }; break;
        case 'rating': sortOption = { rating: -1 }; break;
        case 'mostViewed': sortOption = { viewCount: -1 }; break;
        default: sortOption = { createdAt: -1 };
      }
    }

    const pageSize = Number(req.query.pageSize) || 20;
    const page = Number(req.query.page) || 1;
    const skip = (page - 1) * pageSize;

    const count = await Product.countDocuments(query);
    const products = await Product.find(query)
      .sort(sortOption)
      .limit(pageSize)
      .skip(skip)
      .select('name slug image price category tags isNewArrival isBestSeller rating numReviews countInStock badge variants')
      .lean();

    if (req.query.page || req.query.pageSize) {
      return res.status(200).json({
        products,
        page,
        pages: Math.ceil(count / pageSize),
        total: count
      });
    }

    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getHomeProducts = async (req, res) => {
  try {
    // Parallel fetch for the two core built-in sections
    const [newArrivals, bestSellers] = await Promise.all([
      Product.find({ isNewArrival: true })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('name slug image price category rating numReviews tags isNewArrival isBestSeller variants countInStock')
        .lean(),
      Product.find({ isBestSeller: true })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('name slug image price category rating numReviews tags badge isNewArrival isBestSeller variants countInStock')
        .lean()
    ]);
    
    // Fetch most recent custom-badged products (using badge field OR tags array)
    // Optimized: Use a more index-friendly query and limit fields further
    const badgedProducts = await Product.find({ 
      $or: [
        { badge: { $gt: '' } },
        { tags: { $exists: true, $not: { $size: 0 } } }
      ]
    })
    .sort({ createdAt: -1 })
    .limit(80) // Reduced limit for faster processing
    .select('name slug image price category rating numReviews tags badge isNewArrival isBestSeller countInStock')
    .lean();

    const sectionsMap = new Map();
    
    // Group products dynamically
    if (badgedProducts && badgedProducts.length > 0) {
      badgedProducts.forEach(p => {
        // 1. Group by dedicated 'badge' field (Primary)
        const badge = p.badge?.trim();
        if (badge) {
          // Skip if the badge is just reinforcing the core sections
          if (badge.toLowerCase() === 'new arrival' || badge.toLowerCase() === 'best seller') {
            // Do nothing, already handled by core sections
          } else {
            if (!sectionsMap.has(badge)) sectionsMap.set(badge, []);
            if (sectionsMap.get(badge).length < 10 && !sectionsMap.get(badge).find(item => item._id.toString() === p._id.toString())) {
              sectionsMap.get(badge).push(p);
            }
          }
        }
        
        // 2. Group by custom tags (Secondary fallback)
        if (Array.isArray(p.tags) && p.tags.length > 0) {
          p.tags.forEach(t => {
             const tag = t?.trim();
             if (!tag) return;

             // Skip if the tag is just reinforcing the core sections
             if (tag.toLowerCase() === 'new arrival' || tag.toLowerCase() === 'best seller') return;
             
             if (!sectionsMap.has(tag)) sectionsMap.set(tag, []);
             if (sectionsMap.get(tag).length < 10 && !sectionsMap.get(tag).find(item => item._id.toString() === p._id.toString())) {
               sectionsMap.get(tag).push(p);
             }
          });
        }
      });
    }

    const dynamicSections = Array.from(sectionsMap.entries())
      .map(([title, items]) => {
        // Deduplicate: remove items that are already in newArrivals or bestSellers
        const filteredItems = items.filter(item => 
          !newArrivals.some(na => na._id.toString() === item._id.toString()) &&
          !bestSellers.some(bs => bs._id.toString() === item._id.toString())
        );
        return {
          id: title.toLowerCase().replace(/\s+/g, '-'),
          title,
          items: filteredItems
        };
      })
      .filter(section => section.items.length > 0); // Only return sections with items

    // 3. Trending Now (Top viewed products)
    const trending = await Product.find({})
      .sort({ viewCount: -1 })
      .limit(10)
      .select('name slug image price category rating numReviews tags badge isNewArrival isBestSeller variants countInStock')
      .lean();

    res.json({ 
      newArrivals: newArrivals || [], 
      bestSellers: bestSellers || [], 
      dynamicSections: dynamicSections || [], 
      trending: trending || [] 
    });
  } catch (error) {
    logger.error("Home Data Fetch Critical Failure:", { error: error.message, stack: error.stack });
    res.status(500).json({ message: "Internal server error while loading home data" });
  }
};

// @desc    Fetch single product by slug OR ID
// @route   GET /api/products/:slug
// @access  Public
exports.getProductBySlug = async (req, res) => {
  try {
    let product = await Product.findOne({ slug: req.params.slug })
      .populate('reviews.user', 'name firstName')
      .select('-reviews.images -reviews.videos') // Exclude bulky media
      .lean();

    // Fallback: Check by ID if not found by slug (and if valid ObjectId)
    if (!product && require('mongoose').Types.ObjectId.isValid(req.params.slug)) {
      product = await Product.findById(req.params.slug)
        .populate('reviews.user', 'name firstName')
        .select('-reviews.images -reviews.videos') // Exclude bulky media
        .lean();
    }

    if (product) {
      // Increment View Count efficiently without needing a full Mongoose document save
      await Product.updateOne({ _id: product._id }, { $inc: { viewCount: 1 } });
      product.viewCount = (product.viewCount || 0) + 1;
      res.json(product);
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get light variants for a product
// @route   GET /api/products/:id/variants
// @access  Public
exports.getProductVariants = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).select('variants name');
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product.variants || []);
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
    const { category, exclude } = req.query;

    // 1. Contextual recommendations (Same Category as viewed product) - Optimized
    if (category) {
      recommendations = await Product.find({
        category,
        _id: { $ne: exclude }
      })
      .select('name slug image price category rating numReviews countInStock badge variants')
      .limit(limit)
      .lean();
    }

    // 2. Fallback: Best Sellers or New Arrivals if not enough recs
    if (recommendations.length < limit) {
      const existingIds = recommendations.map(p => p._id);
      if (exclude) existingIds.push(exclude);

      const fallback = await Product.find({
        _id: { $nin: existingIds },
        isBestSeller: true
      })
      .select('name slug image price category rating numReviews countInStock badge variants')
      .limit(limit - recommendations.length)
      .lean();
      
      recommendations = [...recommendations, ...fallback];
    }

    // 3. Final Fallback: Just get any products
    if (recommendations.length < limit) {
      const existingIds = recommendations.map(p => p._id);
      if (exclude) existingIds.push(exclude);

      const filler = await Product.find({
        _id: { $nin: existingIds }
      })
      .select('name slug image price category rating numReviews countInStock badge variants')
      .limit(limit - recommendations.length)
      .lean();
      
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

    // --- SOCKET.IO NOTIFICATION ---
    const io = req.app.get('socketio');
    if (io) {
      io.emit('new-review', {
        productName: product.name,
        rating: Number(rating),
        userName: userName,
        comment: comment.substring(0, 50) + (comment.length > 50 ? '...' : ''),
        createdAt: new Date()
      });
    }
    // -----------------------------

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

// Get Full Reviews with Media
exports.getProductFullReviews = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('reviews.user', 'name firstName')
      .select('reviews')
      .lean();
      
    if (!product) return res.status(404).json({ message: 'Product not found' });
    
    // Sort reviews by newest
    const sortedReviews = (product.reviews || []).sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );

    // Limit media per review for stability
    const optimizedReviews = sortedReviews.map(r => ({
      ...r,
      images: r.images?.slice(0, 5) || [],
      videos: r.videos?.slice(0, 2) || []
    }));

    res.json(optimizedReviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Public Reviews (All)
exports.getPublicReviews = async (req, res) => {
  try {
    const reviews = await Product.aggregate([
      { $unwind: "$reviews" },
      { $match: { "reviews.isApproved": true } },
      { $sort: { "reviews.createdAt": -1 } },
      { $limit: 30 }, // Reduced limit from 50
      {
        $project: {
          _id: 0,
          productId: "$_id",
          productName: "$name",
          productSlug: "$slug",
          productImage: "$image",
          review: {
            _id: "$reviews._id",
            name: "$reviews.name",
            rating: "$reviews.rating",
            comment: "$reviews.comment",
            user: "$reviews.user",
            isVerifiedPurchase: "$reviews.isVerifiedPurchase",
            createdAt: "$reviews.createdAt",
            // Limit media to first item to avoid massive payloads
            images: { $slice: ["$reviews.images", 1] },
            videos: { $slice: ["$reviews.videos", 1] }
          }
        }
      }
    ]);

    res.json(reviews);
  } catch (error) {
    console.error("Public Reviews Error:", error);
    res.status(500).json({ message: "Failed to fetch reviews" });
  }
};

// Get Featured Reviews (Top rated from all products)
exports.getFeaturedReviews = async (req, res) => {
  try {
    // 1. Fetch only 50 most recently updated products with reviews
    // This dramatically reduces memory footprint compared to fetching all products
    const products = await Product.find({ numReviews: { $gt: 0 } })
      .sort({ updatedAt: -1 })
      .limit(50)
      .select('name slug image reviews')
      .lean();

    // 2. Flatten reviews in memory
    let allReviews = [];
    products.forEach(product => {
      if (Array.isArray(product.reviews)) {
        product.reviews.forEach(review => {
          allReviews.push({
            productName: product.name,
            productSlug: product.slug,
            productImage: product.image,
            review: review
          });
        });
      }
    });

    // 3. Sort by newest and grab the top 10
    const sortedReviews = allReviews
      .sort((a, b) => new Date(b.review.createdAt) - new Date(a.review.createdAt))
      .slice(0, 10);

    // 4. Optimize media payload
    const optimizedReviews = sortedReviews.map(item => ({
      ...item,
      review: {
        ...item.review,
        images: item.review.images?.slice(0, 1) || [],
        videos: item.review.videos?.slice(0, 1) || []
      }
    }));

    res.json(optimizedReviews);
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

    // --- CLOUDINARY CLEANUP ---
    if (review.images && review.images.length > 0) {
      review.images.forEach(img => {
        const publicId = extractPublicId(img);
        if (publicId) {
          deleteFromCloudinary(publicId).catch(err => console.error("Cloudinary Delete Error (Review Img):", err));
        }
      });
    }

    if (review.videos && review.videos.length > 0) {
      review.videos.forEach(vid => {
        const publicId = extractPublicId(vid);
        if (publicId) {
          deleteFromCloudinary(publicId, 'video').catch(err => console.error("Cloudinary Delete Error (Review Vid):", err));
        }
      });
    }
    // -------------------------

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

    // Optimization: Slice media for user reviews
    const optimizedReviews = userReviews.map(item => ({
      ...item,
      review: {
        ...item.review,
        images: item.review.images?.slice(0, 3) || [],
        videos: item.review.videos?.slice(0, 1) || []
      }
    }));

    res.json(optimizedReviews);
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

    const { name, price, category, subcategory, image, images, description, richDescription, isBestSeller, isNewArrival, countInStock, discountPrice, specs, tags, badge, video, variants, seo } = req.body;

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
      tags: tags ? tags.filter(t => t && t.trim()).map(t => t.trim()) : [],
      // NEW ADVANCED FIELDS
      video,
      variants: variants || [],
      seo: seo || {},
      isBestSeller: isBestSeller || false,
      isNewArrival: isNewArrival || false,
      badge: badge || ''
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
  console.log("UPDATE PRODUCT PAYLOAD:", req.body);
  try {
    const { name, price, description, richDescription, image, images, category, subcategory, countInStock, isBestSeller, isNewArrival, badge, discountPrice, specs, tags, video, variants, seo } = req.body;
    const product = await Product.findById(req.params.id);

    if (product) {
      // CAPTURE OLD STATE
      const oldPrice = product.price;
      const oldStock = product.countInStock;
      const oldVariants = product.variants ? product.variants.map(v => v.toObject()) : [];

      product.name = name || product.name;
      product.price = price || product.price;
      product.description = description || product.description;
      product.seo = seo || product.seo;
      product.richDescription = richDescription || product.richDescription;

      // --- CLOUDINARY CLEANUP ---
      // 1. Check if main image changed
      if (image && image !== product.image) {
        const oldPublicId = extractPublicId(product.image);
        if (oldPublicId) {
          deleteFromCloudinary(oldPublicId).catch(err => console.error("Cloudinary Delete Error (Main):", err));
        }
      }

      // 2. Check if gallery images were removed
      if (images && Array.isArray(images)) {
        const removedImages = product.images.filter(img => !images.includes(img));
        removedImages.forEach(img => {
          const publicId = extractPublicId(img);
          if (publicId) {
            deleteFromCloudinary(publicId).catch(err => console.error("Cloudinary Delete Error (Gallery):", err));
          }
        });
      }
      // -------------------------

      product.image = image || product.image;
      product.images = images || product.images;

      const updatedProduct = await product.save();

      if (oldStock <= 0 && updatedProduct.countInStock > 0 && (!updatedProduct.variants || updatedProduct.variants.length === 0)) {
        triggerWaitlistNotifications(updatedProduct);
      }

      // LOG MAIN STOCK CHANGE
      if (oldStock !== updatedProduct.countInStock) {
        logStockChange({
          productId: product._id,
          oldStock: oldStock,
          newStock: updatedProduct.countInStock,
          reason: req.body.stockReason || 'Admin Adjustment',
          referenceId: req.user._id,
          adminId: req.user._id,
          note: req.body.stockNote || `Direct update via Admin Panel`
        });
      }

      // LOG VARIANT CHANGES
      // Heuristic: Match by Size/Color and check stock
      if (updatedProduct.variants && updatedProduct.variants.length > 0) {
        updatedProduct.variants.forEach(newVar => {
          const oldVar = oldVariants.find(ov => ov.size === newVar.size && ov.color === newVar.color);
          if (oldVar) {
            if (oldVar.stock <= 0 && newVar.stock > 0) {
              triggerWaitlistNotifications(updatedProduct, newVar);
            }

            if (oldVar.stock !== newVar.stock) {
              logStockChange({
                productId: product._id,
                variant: { size: newVar.size, color: newVar.color },
                oldStock: oldVar.stock,
                newStock: newVar.stock,
                reason: req.body.stockReason || 'Admin Adjustment',
                referenceId: req.user._id,
                adminId: req.user._id,
                note: req.body.stockNote || `Variant Stock Adjusted`
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

      // TRIGGER PRICE DROP ALERTS
      if (oldPrice > updatedProduct.price) {
        // Price was lowered
        triggerPriceDropAlerts(updatedProduct);
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
      // --- CLOUDINARY CLEANUP ---
      // Delete main image
      const mainPublicId = extractPublicId(product.image);
      if (mainPublicId) {
        deleteFromCloudinary(mainPublicId).catch(err => console.error("Cloudinary Delete Error (Main):", err));
      }

      // Delete gallery images
      if (product.images && product.images.length > 0) {
        product.images.forEach(img => {
          const publicId = extractPublicId(img);
          if (publicId) {
            deleteFromCloudinary(publicId).catch(err => console.error("Cloudinary Delete Error (Gallery):", err));
          }
        });
      }

      // Delete video if it's a Cloudinary URL
      if (product.video) {
        const videoPublicId = extractPublicId(product.video);
        if (videoPublicId) {
          deleteFromCloudinary(videoPublicId, 'video').catch(err => console.error("Cloudinary Delete Error (Video):", err));
        }
      }
      // -------------------------

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
// Bulk Update Products
exports.bulkUpdateProducts = async (req, res) => {
  const { edits } = req.body; // { productId: { price, countInStock, category, isActive } }

  if (!edits) return res.status(400).json({ message: 'No edits provided' });

  try {
    const productIds = Object.keys(edits);
    const updatePromises = productIds.map(async (id) => {
      const updateData = edits[id];
      const product = await Product.findById(id);
      if (!product) return null;

      const oldStock = product.countInStock;
      const newStock = updateData.countInStock !== undefined ? Number(updateData.countInStock) : oldStock;

      // Filter out only allowed fields for direct update
      const allowedFields = ['price', 'category', 'isActive'];
      const filteredUpdate = {};
      Object.keys(updateData).forEach(field => {
        if (allowedFields.includes(field)) {
          filteredUpdate[field] = updateData[field];
        }
      });

      // Handle Stock separately for logging
      if (updateData.countInStock !== undefined && oldStock !== newStock) {
        filteredUpdate.countInStock = newStock;
        await logStockChange({
          productId: id,
          oldStock: oldStock,
          newStock: newStock,
          reason: req.body.stockReason || 'Admin Adjustment',
          adminId: req.user._id,
          note: req.body.stockNote || 'Bulk Update'
        });
      }

      return Product.findByIdAndUpdate(id, { $set: filteredUpdate }, { new: true });
    });

    await Promise.all(updatePromises);
    res.json({ message: 'Products updated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Manual Stock Adjustment (Restock)
// @route   POST /api/products/:id/stock
// @access  Private/Admin
exports.manualRestock = async (req, res) => {
  try {
    const { qty, variant, reason, note } = req.body;
    const { adjustStock } = require('../utils/stockUtils');

    if (!qty || isNaN(qty)) {
      return res.status(400).json({ message: "Valid quantity is required" });
    }

    const updatedProduct = await adjustStock(
      req.params.id,
      variant,
      Number(qty),
      reason || 'Restock',
      'Manual',
      req.user._id,
      note
    );

    res.json(updatedProduct);
  } catch (error) {
    console.error("Restock Error:", error.message);
    res.status(500).json({ message: error.message });
  }
};

// --- AUTOMATION HELPERS ---

const triggerPriceDropAlerts = async (product) => {
  try {
    const User = require('../models/User');
    const Notification = require('../models/Notification');

    // Find all users who have this product in their wishlist
    const users = await User.find({ wishlist: product._id });

    if (users.length === 0) return;

    const notifications = users.map(user => ({
      user: user._id,
      title: "📉 Price Drop Alert!",
      message: `Good news! ${product.name} is now available at a lower price: ₹${product.price.toLocaleString()}. Grab it before it's gone!`,
      type: 'promo',
      data: { url: `/product/${product.slug}`, productId: product._id }
    }));

    await Notification.insertMany(notifications);
    console.log(`Price drop alerts sent to ${users.length} users for ${product.name}`);
  } catch (error) {
    console.error("Price Drop Alert Error:", error);
  }
};

// @desc    Get dynamic filter data (categories, sizes, colors)
// @route   GET /api/products/filters
// @access  Public
exports.getFilterData = async (req, res) => {
  try {
    const results = await Product.aggregate([
      {
        $facet: {
          categories: [{ $group: { _id: "$category" } }],
          subcategories: [{ $group: { _id: "$subcategory" } }],
          variantSizes: [
            { $unwind: "$variants" },
            { $group: { _id: "$variants.size" } }
          ],
          variantColors: [
            { $unwind: "$variants" },
            { $group: { _id: "$variants.color" } }
          ],
          specSizes: [
            { $unwind: "$specs" },
            { $match: { "specs.key": { $regex: /size|dimension/i } } },
            { $group: { _id: "$specs.value" } }
          ],
          specColors: [
            { $unwind: "$specs" },
            { $match: { "specs.key": { $regex: /color|shade|finish/i } } },
            { $group: { _id: "$specs.value" } }
          ],
          allSpecs: [
            { $unwind: "$specs" },
            { $group: { _id: "$specs.key", values: { $addToSet: "$specs.value" } } }
          ]
        }
      }
    ]);

    const data = results[0];
    const sizes = new Set([
      ...data.variantSizes.map(v => v._id),
      ...data.specSizes.map(v => v._id)
    ].filter(Boolean));
    
    const colors = new Set([
      ...data.variantColors.map(v => v._id),
      ...data.specColors.map(v => v._id)
    ].filter(Boolean));

    const specs = {};
    data.allSpecs.forEach(item => {
      const key = item._id;
      const lowerKey = key.toLowerCase();
      if (['color', 'shade', 'finish', 'size', 'dimension', 'dimensions'].includes(lowerKey)) return;
      specs[key] = item.values.sort();
    });

    res.json({
      categories: ['All', ...data.categories.map(c => c._id).filter(c => c && c !== 'All')].slice(0, 15),
      subcategories: data.subcategories.map(s => s._id).filter(Boolean),
      sizes: Array.from(sizes).sort(),
      colors: Array.from(colors).sort(),
      specs
    });
  } catch (error) {
    console.error("Filter Aggregation Error:", error);
    res.status(500).json({ message: "Failed to fetch filter data" });
  }
};

// @desc    Subscribe to product waitlist
// @route   POST /api/products/:id/waitlist
// @access  Public
exports.subscribeWaitlist = async (req, res) => {
  try {
    const { email, variant } = req.body;
    const Waitlist = require('../models/Waitlist');

    if (!email) return res.status(400).json({ message: "Email required" });

    // Check if already exists
    const existing = await Waitlist.findOne({ email, product: req.params.id, 'variant.size': variant?.size, 'variant.color': variant?.color, isNotified: false });
    if (existing) return res.status(200).json({ message: "You are already on the waitlist!" });

    await Waitlist.create({
      email,
      product: req.params.id,
      variant
    });

    res.status(201).json({ message: "Subscribed successfully! We'll notify you when it's back." });
  } catch (error) {
    res.status(500).json({ message: "Subscription failed" });
  }
};

// HELPER: Trigger Waitlist Notifications
const triggerWaitlistNotifications = async (product, variant = null) => {
  try {
    const Waitlist = require('../models/Waitlist');
    const sendEmail = require('../utils/sendEmail');

    const query = { product: product._id, isNotified: false };
    if (variant) {
      query['variant.size'] = variant.size;
      query['variant.color'] = variant.color;
    }

    const waitlisted = await Waitlist.find(query);
    if (waitlisted.length === 0) return;

    for (const item of waitlisted) {
      try {
        await sendEmail({
          type: 'press',
          email: item.email,
          subject: `Good news! ${product.name} is back in stock`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee;">
              <h2 style="text-transform: uppercase; letter-spacing: 2px;">It's Back!</h2>
              <p>Hi there, the item you were waiting for is now back in stock at <b>SLOOK</b>.</p>
              <div style="display: flex; gap: 20px; align-items: center; margin: 30px 0;">
                <img src="${product.image}" style="width: 100px; height: 120px; object-cover: cover; border-radius: 10px;" />
                <div>
                  <h3 style="margin: 0;">${product.name}</h3>
                  ${item.variant ? `<p style="font-size: 12px; color: #666; text-transform: uppercase;">${item.variant.size || ''} ${item.variant.size && item.variant.color ? '/' : ''} ${item.variant.color || ''}</p>` : ''}
                  <p style="font-weight: bold; margin: 10px 0;">₹${product.price.toLocaleString()}</p>
                </div>
              </div>
              <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/product/${product.slug}" style="display: inline-block; background: black; color: white; padding: 15px 30px; text-decoration: none; text-transform: uppercase; font-size: 12px; font-weight: bold; letter-spacing: 1px; border-radius: 5px;">Shop Now</a>
              <p style="margin-top: 40px; font-size: 10px; color: #999; text-transform: uppercase;">You received this because you asked to be notified when this item was back in stock.</p>
            </div>
          `
        });

        item.isNotified = true;
        item.notifiedAt = new Date();
        await item.save();
      } catch (emailErr) {
        console.error("Failed to send waitlist email to:", item.email);
      }
    }
    console.log(`Waitlist notifications sent for ${product.name}`);
  } catch (err) {
    console.error("Waitlist Trigger Error:", err);
  }
};
