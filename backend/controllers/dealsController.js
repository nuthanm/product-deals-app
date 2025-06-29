const axios = require('axios');
const Product = require('../models/Product');
const ProductHistory = require('../models/ProductHistory');
const ProductResponse = require('../models/ProductResponse');
const redis = require('redis');
let redisClient;

// Initialize Redis client if enabled
if (process.env.REDIS_ENABLED === 'true') {
  redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  });
  
  redisClient.on('error', (err) => {
    console.error('Redis error:', err);
  });
  
  redisClient.connect().catch(console.error);
}

/**
 * Get product deals from SerpAPI
 */
exports.getProductDeals = async (req, res) => {
  try {
    const { products } = req.body;
    //Todo: Remove this console log in production
    console.log('Received products:', products);
    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ message: 'Products array is required' });
    }
    
    if (products.length > 5) {
      return res.status(400).json({ message: 'Maximum 5 products allowed' });
    }
    
    // Create or find products in database
    const productDocs = await Promise.all(products.map(async (product) => {
      if (product.id) {
        // Check if product exists by ID
        console.log('Product ID:', product.id);
        return await Product.findById(product.id);
      } else {
        // Check if product exists by name
        let existingProduct = await Product.findOne({ 
          name: { $regex: new RegExp(`^${product.name}$`, 'i') }
        });
        
        if (!existingProduct) {
          existingProduct = await Product.create({
            name: product.name,
            category: 'General'
          });
        }
        
        return existingProduct;
      }
    }));
    
    // Filter out any null values
    const validProductDocs = productDocs.filter(p => p);
    //Todo: Remove this console log in production
    console.log('Valid product documents:', validProductDocs);
    if (validProductDocs.length === 0) {
      return res.status(400).json({ message: 'No valid products found' });
    }
    
    // Create product history entry
    // const productHistory = await ProductHistory.create({
    //   products: validProductDocs.map(p => p.id)
    // });
    
    // Generate cache key based on sorted product IDs
    const productIds = validProductDocs.map(p => p._id.toString()).sort().join('-');
    //Todo: Remove this console log in production
    console.log('Product IDs:', productIds);
    // const cacheKey = `deals:${productIds}`;
    
    // // Check cache first
    // let cachedResponse = null;
    // if (redisClient && redisClient.isReady) {
    //   const cachedData = await redisClient.get(cacheKey);
    //   if (cachedData) {
    //     cachedResponse = JSON.parse(cachedData);
    //   }
    // }
    
    // // Check database cache if Redis cache not found
    // if (!cachedResponse) {
    //   const existingResponse = await ProductResponse.findOne({
    //     'products.product': { $all: validProductDocs.map(p => p.id) },
    //     expiresAt: { $gt: new Date() }
    //   }).populate('products.product');
      
    //   if (existingResponse) {
    //     cachedResponse = existingResponse.products;
    //   }
    // }
    
    // // If cached response exists, return it
    // if (cachedResponse) {
    //   return res.json(cachedResponse);
    // }
    
    // Otherwise, fetch from SerpAPI
    const start = parseInt(req.query.start || '0');
    const productDeals = await Promise.all(validProductDocs.map(async (product) => {
      try {
        const deals = await fetchDealsFromSerpAPI(product.name, start);        
        return {
          product: {
            id: product.id,
            name: product.name
          },
          deals
        };
      } catch (error) {
        console.error(`Error fetching deals for ${product.name}:`, error);
        return {
          product: {
            id: product.id,
            name: product.name
          },
          deals: []
        };
      }
    }));
    
    // Save response to database
    // const productResponse = await ProductResponse.create({
    //   productHistory: productHistory.id,
    //   products: productDeals.map(pd => ({
    //     product: pd.product.id,
    //     name: pd.product.name,
    //     deals: pd.deals
    //   }))
    // });
    
    // Cache in Redis if enabled
    if (redisClient && redisClient.isReady) {
      await redisClient.set(cacheKey, JSON.stringify(productDeals), {
        EX: 86400 // 24 hours
      });
    }
    
    res.json(productDeals);
  } catch (error) {
    console.error('Error in getProductDeals:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Fetch deals from SerpAPI supports pagination
 */
async function fetchDealsFromSerpAPI(name, start = 0) {
  try {
    const apiKey = process.env.SERPAPI_KEY;    
    
    if (!apiKey) {
      throw new Error('SERPAPI_KEY is not defined in environment variables');
    }
    
    const params = {
      api_key: apiKey,
      q: name,
      engine: 'google_shopping',
      google_domain: 'google.com.au',
      hl: 'en',
      gl: 'au',
      tdm: 'shop',
      start,
      num: 10, // fetch more 10 results per request
      direct_link: true,
    };

    const response = await axios.get('https://serpapi.com/search', { params });
    if (!response.data || !response.data.shopping_results) {
      return [];
    }

    let allowedSources = [];
    try {
          allowedSources = JSON.parse(process.env.ALLOWED_SOURCES || '[]');
    } catch (e) {
          console.error('Failed to parse ALLOWED_SOURCES:', e);
    }

    // With no filtering
    const results = response.data?.shopping_results;
    /*
    const results = (response.data?.shopping_results || []).filter(item => {
      const source = (item.source || '').toLowerCase();
      const link = (item.product_link || item.link || '').toLowerCase();
      return allowedSources.some(s => source.includes(s) || link.includes(s));
    });
    */
    return results.map(item => ({
      title: item.title,
      link: item.product_link || item.link,
      image: item.thumbnail,
      price: item.price,
      source: item.source,
      rating: item.rating,
      reviews: item.reviews,
      shipping: item.shipping,
    }));
  } catch (error) {
    console.error('SerpAPI error:', error);
    return [];
  }
}
