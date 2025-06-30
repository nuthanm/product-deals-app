const axios = require('axios');
const Product = require('../models/Product');
const ProductHistory = require('../models/ProductHistory');
const ProductResponse = require('../models/ProductResponse');
const { filterByAllowedSources } = require('../utils/sourceFilter');

function normalizeSourceName(source) {
  const s = source.toLowerCase();
  if (s.includes('coles')) return 'coles';
  if (s.includes('woolworths')) return 'woolworths';
  return null;
}

exports.getProductDeals = async (req, res) => {
  try {
    const { products } = req.body;
    const start = parseInt(req.query.start || '0');

    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ message: 'Products array is required' });
    }

    if (products.length > 5) {
      return res.status(400).json({ message: 'Maximum 5 products allowed' });
    }

    let sourceUpdateDays = {};
    try {
      sourceUpdateDays = JSON.parse(process.env.SOURCE_UPDATE_DAYS || '{}');
    } catch (err) {
      console.error('Failed to parse SOURCE_UPDATE_DAYS:', err);
    }

    const today = new Date();
    const productDocs = await Promise.all(products.map(async (product) => {
      if (product.id) return await Product.findById(product.id);
      const existing = await Product.findOne({ name: new RegExp(`^${product.name}$`, 'i') });
      return existing || await Product.create({ name: product.name, category: 'General' });
    }));

    const validProductDocs = productDocs.filter(Boolean);
    if (validProductDocs.length === 0) {
      return res.status(400).json({ message: 'No valid products found' });
    }

    const productHistory = await ProductHistory.create({
      products: validProductDocs.map(p => p._id)
    });

    const productDeals = [];

    for (const product of validProductDocs) {
      let existing = await ProductResponse.findOne({
        'products.product': product._id,
        expiresAt: { $gt: new Date() }
      });

      const dealsFromAPI = await fetchDealsFromSerpAPI(product.name, start);
      const timestampedDeals = dealsFromAPI.map(d => ({ ...d, fetchedAt: new Date() }));

      if (existing) {
        const productEntry = existing.products.find(p => p.product.toString() === product._id.toString());
        const existingDeals = productEntry?.deals || [];

        const MAX_VALID_DAYS = 6;

        const isFresh = existingDeals.every(deal => {
          const normalizedSource = normalizeSourceName(deal.source || '');
          const updateDay = sourceUpdateDays[normalizedSource];

          if (!updateDay || !deal.fetchedAt) return false;

          const fetched = new Date(deal.fetchedAt);
          const now = new Date();
          const ageInDays = (now - fetched) / (1000 * 60 * 60 * 24);
          return ageInDays <= MAX_VALID_DAYS;
        });

        const newDeals = timestampedDeals.filter(newDeal =>
          !existingDeals.some(existing => existing.title === newDeal.title || existing.link === newDeal.link)
        );

        if (newDeals.length > 0) {
          productEntry.deals.push(...newDeals);
          await existing.save();
        }

        productDeals.push({
          product: { id: product._id, name: product.name },
          deals: productEntry.deals,
          source: isFresh && start === 0 ? 'db' : 'api'
        });

        continue;
      }

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

async function fetchDealsFromSerpAPI(name, start = 0) {
  try {
    const apiKey = process.env.SERPAPI_KEY;
    if (!apiKey) throw new Error('SERPAPI_KEY not defined');

    const params = {
      api_key: apiKey,
      q: name,
      engine: 'google_shopping',
      google_domain: 'google.com.au',
      hl: 'en',
      gl: 'au',
      tdm: 'shop',
      start: 0,
      num: 40,
      direct_link: true,
    };

    const response = await axios.get('https://serpapi.com/search', { params });
    const rawResults = response.data?.shopping_results || [];

    const paginatedRaw = rawResults.slice(start, start + 10);
    const filteredResults = filterByAllowedSources(paginatedRaw);

    console.log(`SerpAPI returned ${rawResults.length} total. Returning ${filteredResults.length} after filtering.`);

    return filteredResults.map(item => ({
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
