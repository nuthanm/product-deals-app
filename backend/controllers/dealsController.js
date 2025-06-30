const axios = require('axios');
const Product = require('../models/Product');
const ProductHistory = require('../models/ProductHistory');
const ProductResponse = require('../models/ProductResponse');
const redis = require('redis');
const {
  filterByAllowedSources
} = require('../utils/sourceFilter');

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
    const start = parseInt(req.query.start || '0');
    
    // Validate products array
    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ message: 'Products array is required' });
    }
    
    // Limit to maximum 5 products
    if (products.length > 5) {
      return res.status(400).json({ message: 'Maximum 5 products allowed' });
    }
    
    // Parse SOURCE_UPDATE_DAYS from environment variable
    // This should be a JSON string like '{"coles": 3, "woolworths": 5}'
    let sourceUpdateDays = {};
    try {
      sourceUpdateDays = JSON.parse(process.env.SOURCE_UPDATE_DAYS || '{}');
    } catch (err) {
      console.error("❌ Failed to parse SOURCE_UPDATE_DAYS from env:", err);
    }

    // Create or find products in database
    const today = new Date();
    const todayDay = today.getDay();

    const productDocs = await Promise.all(products.map(async (product) => {
      if (product.id) return await Product.findById(product.id);

      let existing = await Product.findOne({ name: new RegExp(`^${product.name}$`, 'i') });
      return existing || await Product.create({ name: product.name, category: 'General' });
    }));
    
    // Filter out any null values
    const validProductDocs = productDocs.filter(p => p);
    
    if (validProductDocs.length === 0) {
      return res.status(400).json({ message: 'No valid products found' });
    }
    
    const productHistory = await ProductHistory.create({
        products: validProductDocs.map(p => p._id)
   });

    
    const productDeals = [];

    for (const product of validProductDocs) 
    {
        let needsUpdate = true;
      
        let existing = await ProductResponse.findOne({
            'products.product': product._id,
            'products.deals': { $exists: true, $ne: [] },
            expiresAt: { $gt: new Date() } // ensures not expired
      });


       if (existing) {
           const storedDeals = existing.products.find(p => p.product.toString() === product._id.toString())?.deals || [];

           needsUpdate = storedDeals.some(deal => {
              const source = (deal.source || '').toLowerCase();
              const normalizedSource = source.includes("coles") ? "coles"
                        : source.includes("woolworths") ? "woolworths"
                        : null;

              const updateDay = sourceUpdateDays[normalizedSource];

              if (!updateDay || !deal.fetchedAt) return true;

              const fetched = new Date(deal.fetchedAt);
              const now = new Date();

              // Compare full dates, not just days
              const msSinceFetch = now - fetched;
              const daysSinceFetch = msSinceFetch / (1000 * 60 * 60 * 24);

              // Allow a 7-day freshness window or until next update day
              return daysSinceFetch >= 7 || fetched.getDay() < updateDay;
        });


          if (!needsUpdate) {
             productDeals.push({
               product: { id: product._id, name: product.name },
               deals: storedDeals,
               source: 'db'
            });
            continue;
         }

            // Remove stale data
           await ProductResponse.deleteOne({ _id: existing._id });
        }
        // Fetch fresh deals
        const deals = await fetchDealsFromSerpAPI(product.name, start);
        const timestampedDeals = deals.map(d => ({ ...d, fetchedAt: new Date() }));

        await ProductResponse.create({
            productHistory: productHistory._id,
            products: [{
              product: product._id,
              productName: product.name,
              deals: timestampedDeals
            }]
      });

          productDeals.push({
            product: { id: product._id, name: product.name },
            deals: timestampedDeals,
            source: 'api'
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

    // With no filtering
    let rawResults = response.data?.shopping_results || [];
    console.log('Actual Received from SerpAPI:', rawResults.length, 'items');

    const filteredResults = filterByAllowedSources(rawResults);
    console.log(`Filtered results count: ${filteredResults.length}`);
    
    // ✅ Trim manually to enforce pagination
    results = filteredResults.slice(0, 10);  
    console.log('Sliced result received from SerpAPI:', results.length, 'items');
   
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
