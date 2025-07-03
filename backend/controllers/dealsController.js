/*
Purpose of this class : Handle product deals fetching functionality
This controller provides an endpoint to fetch product deals based on user input.
Dependencies : Product, ProductHistory, ProductResponse models, SerpAPI for fetching deals
Author : Nuthan M
Created Date : 2025-July-03
*/

import axios from "axios";
import Product from "../models/Product.js";
import ProductHistory from "../models/ProductHistory.js";
import ProductResponse from "../models/ProductResponse.js";
import sourceFilter from "../utils/sourceFilter.js";

// Import source filtering utility
// This utility provides functions to filter items based on allowed sources defined in the environment variable ALLOWED_SOURCES
// It includes functions to sanitize source names, check if a source is allowed, and filter items
const { filterByAllowedSources } = sourceFilter;

// Import configuration constants
// These constants are used to define allowed sources, featured product limits.
import config from "../utils/config.js";
const {
  ALLOWED_SOURCES,
  FEATURED_LIMIT,
  MAXIMUM_PRODUCTS_PERDAY_USER_ANONYMOUS,
  MAXIMUM_PRODUCTS_PERDAY_USER_AUTHENTICATED,
} = config;

/**
 * POST /api/deals
 * Body: { products: [{ id?, name }], start?: number }
 */
export async function getProductDeals(req, res) {
  try {
    // How the req.body should look:
    // {
    //   products: [
    //     { id: "productId1" }, // optional, if not provided will
    //     { name: "Product Name 1" }, // required
    //     { id: "productId2" }, // optional, if not provided will
    //     { name: "Product Name 2" } // required
    //   ],
    //   start: 0 // optional, default is 0
    // }

    // Extract products from request body
    const products = req.body?.products;
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ message: "Products array is required" });
    }

    // What is the below line doing?
    // It extracts the 'start' query parameter from the request, defaulting to 0
    // This parameter is used to determine the starting index for pagination of deals
    // It allows the client to specify which page of results they want to retrieve
    // If 'start' is not provided, it defaults to 0
    // This is useful for paginating results, especially when dealing with large datasets
    // It allows the client to request a specific page of results, starting from the specified index.
    const start = parseInt(req.query.start || "0", 10);

    // If the user is authenticated, we can allow more products to be checked
    // This is determined by checking if the user is authenticated via req.user
    // If authenticated, use the configured limit for authenticated users
    // Otherwise, use the limit for anonymous users
    // Default: Anonymous users can only fetch 2 products at a time.
    if (
      products.length >
      (req.user
        ? MAXIMUM_PRODUCTS_PERDAY_USER_AUTHENTICATED
        : MAXIMUM_PRODUCTS_PERDAY_USER_ANONYMOUS)
    ) {
      return res.status(400).json({
        message: `Only ${MAXIMUM_PRODUCTS_PERDAY_USER_ANONYMOUS} products can be checked at a time for guests. Please log in to check more products.`,
      });
    }

    // What is the below block doing?
    // It processes the products array to find or create Product documents in the database.
    // For each product in the array, it checks if an ID is provided.
    // If an ID exists, it fetches the Product by that ID.
    // If no ID is provided, it searches for an existing Product by name (case-insensitive).
    // If no existing Product is found, it creates a new Product with the provided name and a default category of "General".
    // Finally, it filters out any invalid products (null or undefined) and ensures at least one valid product exists.
    // This ensures that the products array contains valid Product documents before proceeding with further operations.
    const productDocs = await Promise.all(
      products.map(async (p) => {
        if (p.id) return Product.findById(p.id);

        const existing = await Product.findOne({
          name: new RegExp(`^${p.name}$`, "i"),
        });
        // If no existing product found, create a new one with default category
        // This ensures that we always have a valid Product document to work with.
        return (
          existing || Product.create({ name: p.name, category: "General" })
        );
      })
    );

    // Filter out any null or undefined products
    // This step ensures that we only work with valid Product documents.
    const valid = productDocs.filter(Boolean);
    if (valid.length === 0) {
      return res.status(400).json({ message: "No valid products found" });
    }

    // What is the below block doing?
    // It creates a new ProductHistory document to track the products being processed.
    // Todo: We should consider adding a user reference here in the future
    // This document will store the IDs of the products being processed based out of User too.
    // So that we can track which user checked which products and show this statistics to the user dashboard.
    // This is useful for maintaining a history of product checks and can be used for analytics or user tracking.
    // It creates a new ProductHistory document with the IDs of the valid products.
    const history = await ProductHistory.create({
      products: valid.map((d) => d._id),
    });

    // What is the below block doing?
    // It initializes an empty array to store the results of the product deals.
    // This array will hold the final response containing product details and their associated deals.
    // For each valid product, it attempts to fetch deals either from the cache or by calling the SerpAPI.
    // If the cache is not available or if the 'start' parameter is greater than 0, it fetches fresh deals from the SerpAPI.
    // If the 'start' parameter is 0, it updates or creates a cache entry
    // with the fetched deals for that product.
    // Finally, it pushes the product details and deals into the results array.
    // This results array will be returned as the response to the client.
    // It ensures that each product has its deals fetched and cached appropriately.
    const results = [];
    for (const prod of valid) {
      // Check if we have cached deals for this product
      // This query checks if there is a ProductResponse document that contains deals for the product
      let respDoc = await ProductResponse.findOne({
        "products.product": prod._id,
        expiresAt: { $gt: new Date() },
      });

      // Fetch fresh always when start>0 or cache missing
      let deals = [];
      if (!respDoc || start > 0) {
        deals = await fetchDealsFromSerpAPI(prod.name);

        // If first page, insert/update cache
        if (start === 0) {
          if (!respDoc) {
            respDoc = await ProductResponse.create({
              productHistory: history._id,
              products: [{ product: prod._id, productName: prod.name, deals }],
            });
          } else {
            const entry = respDoc.products.find((e) =>
              e.product.equals(prod._id)
            );
            entry.deals = deals;
            await respDoc.save();
          }
        }
      } else {
        // read from cache
        const entry = respDoc.products.find((e) => e.product.equals(prod._id));
        deals = entry?.deals || [];
      }

      results.push({
        product: { id: prod._id, name: prod.name },
        deals: deals.slice(start, start + 10), // page of 10
        source: start === 0 && respDoc ? "db" : "api",
      });
    }

    res.json(results);
  } catch (err) {
    console.error("getProductDeals error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

/** SerpAPI helper with source filtering **/
async function fetchDealsFromSerpAPI(query) {
  try {
    const apiKey = process.env.SERPAPI_KEY;
    if (!apiKey) throw new Error("SERPAPI_KEY not defined");

    const params = {
      api_key: apiKey,
      q: query,
      engine: "google_shopping",
      google_domain: "google.com.au",
      hl: "en",
      gl: "au",
      tdm: "shop",
      num: 40,
      direct_link: true,
    };
    const { data } = await get("https://serpapi.com/search", { params });

    // filter & normalize
    const raw = data.shopping_results || [];
    const filtered = filterByAllowedSources(raw, ALLOWED_SOURCES);
    return filtered.map((item) => ({
      title: item.title,
      link: item.product_link || item.link,
      image: item.thumbnail,
      price: item.price,
      source: item.source,
      rating: item.rating,
      reviews: item.reviews,
      shipping: item.shipping,
    }));
  } catch (err) {
    console.error("SerpAPI error:", err);
    return [];
  }
}

/**
 * GET /api/deals/best
 * Returns top FEATURED_LIMIT deals (across history)
 */
export async function getBestDeals(req, res) {
  try {
    const limit = parseInt(req.query.limit || FEATURED_LIMIT, 3);

    // 1) Most recent products
    const hist = await ProductHistory.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("products.product");

    const names = hist.flatMap((h) => h.products.map((p) => p.product.name));
    const queries = [...new Set(names)].slice(0, limit);

    // 2) Fetch all
    const lists = await Promise.all(
      queries.map((q) => fetchDealsFromSerpAPI(q))
    );

    const flat = lists.flat();

    // 3) Sort & pick cheapest
    const parsed = flat.map((d) => ({
      ...d,
      priceValue: parseFloat(d.price.replace(/[^0-9.]/g, "")) || Infinity,
    }));
    const best = parsed
      .sort((a, b) => a.priceValue - b.priceValue)
      .slice(0, limit);

    // 4) Attach logos
    const resp = best.map((d) => ({
      title: d.title,
      link: d.link,
      image: d.image,
      price: d.price,
      source: d.source,
      rating: d.rating,
      reviews: d.reviews,
      shipping: d.shipping,
      //      logoUrl: LOGOS[d.source.toLowerCase()] || "/assets/logos/default.png",
    }));

    res.json(resp);
  } catch (err) {
    console.error("getBestDeals error:", err);
    res.status(500).json({ error: "Failed to fetch best deals" });
  }
}
