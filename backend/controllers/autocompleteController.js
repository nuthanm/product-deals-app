const Product = require('../models/Product');
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
 * Get autocomplete results for product search
 */
exports.getAutocompleteResults = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.length < 2) {
      return res.status(400).json({ message: 'Query must be at least 2 characters' });
    }

    // Check Redis cache
    if (redisClient && redisClient.isReady) {
      const cacheKey = `autocomplete:${query.toLowerCase()}`;
      const cachedResults = await redisClient.get(cacheKey);
      if (cachedResults) {
        return res.json(JSON.parse(cachedResults));
      }
    }

    const products = await Product.find({
      name: { $regex: query, $options: 'i' }
    })
    .select('name _id category')
    .limit(10);

    // If no results found, add a generic fallback
    if (products.length === 0) {
      products.push({
        name: query,
        _id: null,
        category: 'General'
      });
    }

    // Mapping should be done after fallback
    const mappedResults = products.map(product => ({
      name: product.name,
      id: product._id,
      category: product.category || 'General'
    }));

    // Cache result
    if (redisClient && redisClient.isReady) {
      const cacheKey = `autocomplete:${query.toLowerCase()}`;
      await redisClient.set(cacheKey, JSON.stringify(mappedResults), { EX: 3600 });
    }

    res.json(mappedResults);
  } catch (error) {
    console.error('Error in autocomplete:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
