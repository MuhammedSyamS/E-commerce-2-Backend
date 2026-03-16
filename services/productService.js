const Product = require('../models/Product');
const logger = require('../utils/logger');

class ProductService {
  async getProducts(queryParams) {
    const {
      keyword, category, subcategory,
      minPrice, maxPrice, sort,
      size, color, minRating, minDiscount,
      isNewArrival, isBestSeller, inStock, isFlashSale,
      page = 1, pageSize = 20
    } = queryParams;

    let query = {};

    if (keyword) {
      query.$or = [
        { name: { $regex: keyword, $options: 'i' } },
        { description: { $regex: keyword, $options: 'i' } },
        { tags: { $regex: keyword, $options: 'i' } }
      ];
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
    const products = await Product.find(query)
      .sort(sortOption)
      .limit(Number(pageSize))
      .skip(skip)
      .lean();

    return {
      products,
      page: Number(page),
      pages: Math.ceil(count / Number(pageSize)),
      total: count
    };
  }
}

module.exports = new ProductService();
