import axios from "axios";
import Product from "../models/Product.js";
import ProductHistory from "../models/ProductHistory.js";
import ProductResponse from "../models/ProductResponse.js";
import sourceFilter from "../utils/sourceFilter.js";
import config from "../utils/config.js";

const {
  ALLOWED_SOURCES,
  MAXIMUM_PRODUCTS_PERDAY_USER_ANONYMOUS,
  MAXIMUM_PRODUCTS_PERDAY_USER_AUTHENTICATED,
} = config;

/**
 * POST /api/deals
 * Body: { products: [{ id?, name }], start?: number }
 *
 * 1. Validate input & pagination parameters
 * 2. Enforce per-user product limits (guest vs. authenticated)
 * 3. Lookup or create Product documents
 * 4. Record a ProductHistory entry
 * 5. For each product:
 *    – Check MongoDB cache (ProductResponse)
 *    – If no cache, empty cache entry, or paginating (start > 0):
 *        • Call SerpAPI, sanitize query, filter by allowed sources
 *        • Update/create cache only on first page
 *    – Else:
 *        • Read deals from cache
 *    – Push { product, deals, source } using a flag to distinguish api vs. db
 */
export async function getProductDeals(req, res) {
  console.log("getProductDeals called with body:", req.body);

  try {
    // 1. Validate request body
    const products = req.body?.products;
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ message: "Products array is required" });
    }

    // 2. Parse pagination start index
    const start = parseInt(req.query.start || "0", 10);
    console.log("Pagination start index:", start);

    // 3. Enforce per-day product limit
    const maxAllowed = req.user
      ? MAXIMUM_PRODUCTS_PERDAY_USER_AUTHENTICATED
      : MAXIMUM_PRODUCTS_PERDAY_USER_ANONYMOUS;
    if (products.length > maxAllowed) {
      return res.status(400).json({
        message: `Only ${MAXIMUM_PRODUCTS_PERDAY_USER_ANONYMOUS} products can be checked at a time for guests. Please log in to check more products.`,
      });
    }

    console.log(req.user ? "Authenticated user" : "Anonymous user");
    console.log(`Processing ${products.length} products (start=${start})`);

    // 4. Resolve or create Product documents
    const productDocs = await Promise.all(
      products.map(async (p) => {
        if (p.id) {
          return Product.findById(p.id);
        }
        // Case-insensitive lookup by name
        const existing = await Product.findOne({
          name: new RegExp(`^${p.name}$`, "i"),
        });
        return (
          existing || Product.create({ name: p.name, category: "General" })
        );
      })
    );
    const valid = productDocs.filter(Boolean);
    if (valid.length === 0) {
      return res.status(400).json({ message: "No valid products found" });
    }
    console.log(
      "Valid products:",
      valid.map((p) => p.name)
    );

    // 5. Record history of this lookup
    const history = await ProductHistory.create({
      products: valid.map((d) => d._id),
    });
    console.log("Created ProductHistory ID:", history._id);

    // 6. Fetch deals for each product
    const results = [];
    for (const prod of valid) {
      // 6a. Check existing cache entry
      const initialRespDoc = await ProductResponse.findOne({
        "products.product": prod._id,
        expiresAt: { $gt: new Date() },
      });
      let respDoc = initialRespDoc;

      // 6b. Decide whether to fetch from SerpAPI
      let fetchedFromApi = false;
      let deals = [];
      if (!initialRespDoc || start > 0) {
        fetchedFromApi = true;
        //  → sanitize & call SerpAPI
        deals = await fetchDealsFromSerpAPI(prod.name);
        console.log(
          `SerpAPI returned ${deals.length} deals for "${prod.name}"`
        );

        // 6c. Update cache only on first page
        if (start === 0) {
          if (!initialRespDoc) {
            respDoc = await ProductResponse.create({
              productHistory: history._id,
              products: [{ product: prod._id, productName: prod.name, deals }],
            });
            console.log(`Cached new deals for "${prod.name}"`);
          } else {
            const entry = respDoc.products.find((e) =>
              e.product.equals(prod._id)
            );
            entry.deals = deals;
            await respDoc.save();
            console.log(`Updated cache for "${prod.name}"`);
          }
        }
      } else {
        // 6d. Cache hit path
        const entry = respDoc.products.find((e) => e.product.equals(prod._id));
        deals = entry?.deals || [];
        console.log(
          `Cache hit for "${prod.name}", returning ${deals.length} deals`
        );
      }

      // 6e. Push final result slice + correctly flagged source
      results.push({
        product: { id: prod._id, name: prod.name },
        deals: deals.slice(start, start + 10),
        source: fetchedFromApi ? "api" : "db",
      });
    }

    return res.json(results);
  } catch (err) {
    console.error("getProductDeals error:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
}

/**
 * Helper: Fetch raw shopping results from SerpAPI,
 * sanitize query, filter by ALLOWED_SOURCES, and normalize fields.
 */
async function fetchDealsFromSerpAPI(rawQuery) {
  try {
    const apiKey = process.env.SERPAPI_KEY;
    if (!apiKey) throw new Error("SERPAPI_KEY not defined");

    // Remove punctuation from search term
    const query = rawQuery.replace(/[^\w\s]/g, "").trim();
    console.log("Searching SerpAPI for:", query);

    const { data } = await axios.get("https://serpapi.com/search", {
      params: {
        api_key: apiKey,
        q: query,
        engine: "google_shopping",
        google_domain: "google.com.au",
        hl: "en",
        gl: "au",
        tdm: "shop",
        num: 40,
        direct_link: true,
      },
    });

    const raw = data.shopping_results || [];
    console.log(`SerpAPI returned ${raw.length} total raw results`);

    // Filter by allowed sources and normalize shape
    const filtered = sourceFilter
      .filterByAllowedSources(raw, ALLOWED_SOURCES)
      .map((item) => ({
        title: item.title,
        link: item.product_link || item.link,
        image: item.thumbnail,
        price: item.price,
        source: item.source,
        rating: item.rating,
        reviews: item.reviews,
        shipping: item.shipping,
      }));

    return filtered;
  } catch (err) {
    console.error("SerpAPI error:", err);
    return [];
  }
}
