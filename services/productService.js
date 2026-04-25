const Product = require('../models/Product');
const logger = require('../utils/logger');

class ProductService {
  async getProducts(queryParams) {
    const {
      category, subcategory,
      minPrice, maxPrice, sort,
      size, color, minRating, minDiscount,
      isNewArrival, isBestSeller, inStock, isFlashSale,
      page = 1, pageSize = 20
    } = queryParams;

    const keyword = (queryParams.keyword || queryParams.search || '').trim();
    let query = {};

    // Support searching by ID if the keyword looks like a MongoDB ObjectId
    if (keyword && /^[0-9a-fA-F]{24}$/.test(keyword)) {
      query._id = keyword;
    } else if (keyword) {
      const words = keyword.split(/\s+/).filter(w => w.length > 0);
      if (words.length > 0) {
        // Multi-word search: all words must be present in at least one of the fields
        query.$and = words.map(word => {
          const searchRegex = new RegExp(word, 'i');
          return {
            $or: [
              { name: { $regex: searchRegex } },
              { tags: { $regex: searchRegex } },
              { category: { $regex: searchRegex } },
              { subcategory: { $regex: searchRegex } },
              { description: { $regex: searchRegex } }
            ]
          };
        });
      }
    }

    if (category && category !== 'All') query.category = category;
    if (subcategory && subcategory !== 'All') query.subcategory = subcategory;

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    if (size) query['variants.size'] = size;
    if (color) query['variants.color'] = color;

    if (isNewArrival === 'true') query.isNewArrival = true;
    if (isBestSeller === 'true') query.isBestSeller = true;
    if (isFlashSale === 'true') query.isFlashSale = true;
    if (inStock === 'true') query.countInStock = { $gt: 0 };

    if (minRating) query.rating = { $gte: Number(minRating) };

    let sortOption = { createdAt: -1 };

    if (sort) {
      switch (sort) {
        case 'price-asc': sortOption = { price: 1 }; break;
        case 'price-desc': sortOption = { price: -1 }; break;
        case 'rating': sortOption = { rating: -1 }; break;
        case 'mostViewed': sortOption = { viewCount: -1 }; break;
        default: sortOption = { createdAt: -1 };
      }
    }

    const skip = (Number(page) - 1) * Number(pageSize);
    const count = await Product.countDocuments(query);
    let products = await Product.find(query)
      .select('name slug image price category rating numReviews countInStock badge tags variants isNewArrival isBestSeller isFlashSale')
      .sort(sortOption)
      .limit(Number(pageSize))
      .skip(skip)
      .lean();

    // --- EXACT MATCH BOOSTING ---
    if (keyword && products.length > 0) {
      const lowerKeyword = keyword.toLowerCase();
      products = products.sort((a, b) => {
        const aExact = a.name.toLowerCase() === lowerKeyword;
        const bExact = b.name.toLowerCase() === lowerKeyword;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;

        const aStarts = a.name.toLowerCase().startsWith(lowerKeyword);
        const bStarts = b.name.toLowerCase().startsWith(lowerKeyword);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;

        return 0; // Maintain original sort (e.g. createdAt or price)
      });
    }
    // ----------------------------

    return {
      products,
      page: Number(page),
      pages: Math.ceil(count / Number(pageSize)),
      total: count
    };
  }
}

module.exports = new ProductService();
