function sanitize(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/gi, '');
}

function getAllowedSources() {
  try {
    return JSON.parse(process.env.ALLOWED_SOURCES || '[]');
  } catch (e) {
    console.error('❌ Failed to parse ALLOWED_SOURCES:', e);
    return [];
  }
}

function isAllowedSource(item) {
  const allowedSources = getAllowedSources();
  const sourceSanitized = sanitize(item.source);
  const linkSanitized = sanitize(item.product_link || item.link || '');

  return allowedSources.some(allowed =>
    sourceSanitized.includes(sanitize(allowed)) ||
    linkSanitized.includes(sanitize(allowed))
  );
}

function filterByAllowedSources(items) {
  return items.filter(isAllowedSource);
}

module.exports = {
  sanitize,
  getAllowedSources,
  isAllowedSource,
  filterByAllowedSources
};