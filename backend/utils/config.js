/*
Purpose of this class : Handle configuration settings for the application.
This module provides constants for allowed sources, featured product limits, and logo URLs.
Dependencies : dotenv for environment variable management
Author : Nuthan M
Created Date : 2025-July-03
*/

require("dotenv").config();

// Validate and parse environment variables
if (!process.env.ALLOWED_SOURCES) {
  throw new Error("ALLOWED_SOURCES environment variable is required");
}
if (!process.env.FEATURED_LIMIT) {
  throw new Error("FEATURED_LIMIT environment variable is required");
}

// Parse ALLOWED_SOURCES from environment variable
// Expected format: '["source1", "source2", ...]'
const ALLOWED_SOURCES = JSON.parse(process.env.ALLOWED_SOURCES || "[]");
if (!Array.isArray(ALLOWED_SOURCES) || ALLOWED_SOURCES.length === 0) {
  throw new Error("ALLOWED_SOURCES must be a non-empty array");
}
// Validate each source in ALLOWED_SOURCES
ALLOWED_SOURCES.forEach((src) => {
  if (typeof src !== "string" || src.trim() === "") {
    throw new Error(`Invalid source in ALLOWED_SOURCES: ${src}`);
  }
});

// Parse FEATURED_LIMIT from environment variable
const FEATURED_LIMIT = parseInt(process.env.FEATURED_LIMIT, 10) || 3;

// Validate FEATURED_LIMIT
if (isNaN(FEATURED_LIMIT) || FEATURED_LIMIT <= 0)
  throw new Error("FEATURED_LIMIT must be a positive integer");

/* TODO: Currently we are not using this, but it can be useful in the future
We basically use this to display logos for each source in the frontend.

// Build a map of source → logo URL
const LOGOS = ALLOWED_SOURCES.reduce((acc, src) => {
  const key = `${src.toUpperCase().replace(/\s+/g, "_")}_LOGO_URL`;
  acc[src] = process.env[key] || "/assets/logos/default.png";
  return acc;
}, {});
*/

export default { ALLOWED_SOURCES, FEATURED_LIMIT };
