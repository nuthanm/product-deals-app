/*
Purpose of this class : Handle frontend logic for product search and deals
This module manages the product search functionality, including autocomplete suggestions, adding products to a list, and fetching deals.
Dependencies : Axios for API requests, DOM manipulation for UI updates.
Author : Nuthan M
Created Date : 2025-July-03
*/

document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = document.querySelector('meta[name="api-base"]').content;
  const productSearch = document.getElementById("product-search");
  const addToListBtn = document.getElementById("add-to-list");
  const autocompleteEl = document.getElementById("autocomplete-results");
  const selectedEl = document.getElementById("selected-products");
  const emptyState = document.getElementById("empty-state");
  const productCountEl = document.getElementById("product-count");
  const getDealsBtn = document.getElementById("get-deals");
  const dealsSection = document.getElementById("deals-results");
  const dealsContainer = document.getElementById("deals-container");
  const recentEl = document.getElementById("recent-searches");
  const clearHistory = document.getElementById("clear-history");
  const moveTop = document.getElementById("move-to-top");
  // Import configuration constants
  // These constants are used to define allowed sources, featured product limits.
  // const {
  //   ALLOWED_SOURCES,
  //   FEATURED_LIMIT,
  //   MAXIMUM_PRODUCTS_PERDAY_USER_ANONYMOUS,
  //   MAXIMUM_PRODUCTS_PERDAY_USER_AUTHENTICATED,
  // } = require("../utils/config.js").default;

  let productList = [];
  const MAX_PRODUCTS = 2; // Maximum products for anonymous users
  let typingTimer;

  /** Renders the “chips” and UI state */
  function updateUI() {
    // Chips
    selectedEl.innerHTML =
      productList.length === 0
        ? emptyState.outerHTML
        : productList
            .map(
              (p, i) => `
        <span class="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full inline-flex items-center mr-2">
          ${p.name}
          <button data-index="${i}" class="ml-2 text-indigo-600 hover:text-indigo-900">&times;</button>
        </span>
      `
            )
            .join("");

    // Count + button states
    productCountEl.textContent = `(${productList.length}/${MAX_PRODUCTS})`;
    const full = productList.length >= MAX_PRODUCTS;
    addToListBtn.disabled = full;
    productSearch.disabled = full;
    getDealsBtn.disabled = productList.length === 0;
  }

  // Remove chip
  selectedEl.addEventListener("click", (e) => {
    if (e.target.tagName === "BUTTON") {
      productList.splice(+e.target.dataset.index, 1);
      updateUI();
    }
  });

  // Autocomplete fetch
  async function fetchAuto(q) {
    try {
      const { data } = await axios.get(
        `${API_BASE}/autocomplete?query=${encodeURIComponent(q)}`
      );
      if (!data || !data.length) {
        autocompleteEl.innerHTML = `<div class="p-3 text-gray-500 text-center">No products found</div>`;
      } else {
        autocompleteEl.innerHTML = data
          .map(
            (p) => `
          <div class="p-3 hover:bg-gray-100 cursor-pointer" data-name="${
            p.name
          }" data-id="${p.id || ""}">
            ${p.name}
          </div>
        `
          )
          .join("");
      }
      autocompleteEl.classList.remove("hidden");
    } catch {}
  }

  productSearch.addEventListener("input", () => {
    clearTimeout(typingTimer);
    const v = productSearch.value.trim();
    if (v.length > 2) {
      typingTimer = setTimeout(() => fetchAuto(v), 300);
    } else {
      autocompleteEl.classList.add("hidden");
    }
  });

  // Pick from autocomplete
  autocompleteEl.addEventListener("click", (e) => {
    const item = e.target.closest("[data-name]");
    if (!item) return;
    productSearch.value = item.dataset.name;
    productSearch.dataset.productId = item.dataset.id;
    autocompleteEl.classList.add("hidden");
  });

  // Add to list
  function addToList() {
    const name = productSearch.value.trim();
    if (!name) return;
    if (productList.length >= MAX_PRODUCTS) return alert(`Max ${MAX_PRODUCTS}`);
    if (productList.some((p) => p.name.toLowerCase() === name.toLowerCase()))
      return;
    productList.push({ id: productSearch.dataset.productId, name });
    productSearch.value = "";
    productSearch.dataset.productId = "";
    updateUI();
  }
  addToListBtn.addEventListener("click", addToList);
  productSearch.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addToList();
    }
  });

  // Get Deals
  async function getDeals() {
    try {
      getDealsBtn.disabled = true;
      getDealsBtn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i>Finding Deals...`;
      const resp = await axios.post(`${API_BASE}/deals?start=0`, {
        products: productList,
      });
      dealsContainer.innerHTML = resp.data
        .map(
          (p) => `
        <div class="mb-8">
          <h4 class="font-semibold mb-4">${p.product.name}</h4>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            ${p.deals
              .map(
                (d) => `
              <a href="${d.link}" target="_blank" class="border rounded-lg overflow-hidden hover:shadow-lg transition">
                <img src="${d.image}" class="w-full h-40 object-contain bg-gray-100" />
                <div class="p-4">
                  <div class="text-indigo-600 font-bold">${d.price}</div>
                  <div class="text-sm text-gray-500">${d.source}</div>
                </div>
              </a>
            `
              )
              .join("")}
          </div>
          <button class="mt-4 btn-load-more bg-indigo-600 text-white px-4 py-2 rounded" data-product="${
            p.product.name
          }">
            Load More
          </button>
        </div>
      `
        )
        .join("");
      dealsSection.classList.remove("hidden");
      window.scrollTo({ top: dealsSection.offsetTop, behavior: "smooth" });
    } catch (err) {
      console.error(err);
      alert("Failed to fetch deals.");
    } finally {
      getDealsBtn.disabled = false;
      getDealsBtn.innerHTML = `<i class="fas fa-search-dollar mr-2"></i>Get Product(s) Deals`;
    }
  }
  document.getElementById("get-deals").addEventListener("click", getDeals);

  // Pagination: Load More
  dealsContainer.addEventListener("click", async (e) => {
    const btn = e.target.closest(".btn-load-more");
    if (!btn) return;
    const productName = btn.dataset.product;
    let start = parseInt(btn.dataset.start || "10", 10);
    try {
      const resp = await axios.post(`${API_BASE}/deals?start=${start}`, {
        products: [{ name: productName }],
      });
      const html = resp.data[0]?.deals
        .map(
          (d) => `
        <a href="${d.link}" target="_blank" class="border rounded-lg overflow-hidden hover:shadow-lg transition">
          <img src="${d.image}" class="w-full h-40 object-contain bg-gray-100" />
          <div class="p-4">
            <div class="text-indigo-600 font-bold">${d.price}</div>
            <div class="text-sm text-gray-500">${d.source}</div>
          </div>
        </a>
      `
        )
        .join("");
      // insert before button
      btn.insertAdjacentHTML(
        "beforebegin",
        `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">${html}</div>`
      );
      btn.dataset.start = start + (resp.data[0]?.deals.length || 0);
      if ((resp.data[0]?.deals.length || 0) < 10) btn.remove();
    } catch {
      alert("Failed to load more");
    }
  });

  // Move to top
  window.addEventListener("scroll", () => {
    moveTop.classList.toggle("hidden", window.scrollY < 300);
  });

  moveTop.addEventListener("click", () =>
    window.scrollTo({ top: 0, behavior: "smooth" })
  );

  // Recent searches & clear
  function loadRecent() {
    const arr = JSON.parse(localStorage.getItem("recentSearches") || "[]");
    recentEl.innerHTML =
      arr
        .map(
          (p, i) => `
      <div class="p-3 border rounded relative">
        <button data-index="${i}" class="absolute top-2 right-2 text-gray-400 hover:text-red-500">
          <i class="fas fa-times-circle"></i>
        </button>
        <div class="font-medium mb-2">${p.name}</div>
        <button data-name="${p.name}" class="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs find-deals">
          Find Deals
        </button>
      </div>
    `
        )
        .join("") ||
      `<div class="col-span-full text-center text-gray-500 italic">No recent searches</div>`;
  }
  clearHistory.addEventListener("click", () => {
    localStorage.removeItem("recentSearches");
    loadRecent();
  });
  recentEl.addEventListener("click", (e) => {
    if (e.target.matches("[data-index]")) {
      const idx = +e.target.dataset.index;
      const arr = JSON.parse(localStorage.getItem("recentSearches") || "[]");
      arr.splice(idx, 1);
      localStorage.setItem("recentSearches", JSON.stringify(arr));
      loadRecent();
    }
    if (e.target.matches(".find-deals")) {
      const name = e.target.dataset.name;
      productSearch.value = name;
      addToList();
    }
  });

  // Save in recent after a successful search
  function saveRecent() {
    let arr = JSON.parse(localStorage.getItem("recentSearches") || "[]");
    productList.forEach((p) => {
      if (!arr.some((x) => x.name === p.name)) arr.unshift(p);
    });
    arr = arr.slice(0, 10);
    localStorage.setItem("recentSearches", JSON.stringify(arr));
    loadRecent();
  }

  // Load featured deals
  async function loadFeaturedDeals() {
    const limit = 3;
    try {
      const { data } = await axios.get(`${API_BASE}/deals/best?limit=${limit}`);
      document.getElementById("featured-deals-container").innerHTML = data
        .map(
          (d) => `
        <div class="bg-white rounded-lg shadow p-6 flex flex-col">
          <img src="${d.image}" alt="${
            d.title
          }" class="h-40 object-cover rounded-md mb-4"/>
          <div class="flex items-center mb-2">
            <h3 class="font-semibold text-lg flex-grow">${d.title}</h3>
            <img src="${d.logoUrl}" alt="${d.source}" class="h-6 w-auto ml-2"/>
          </div>
          <p class="text-gray-500 mb-4">${d.price} at ${d.source}</p>
          <span class="mt-auto text-green-600 font-bold">Save ${
            d.savings || ""
          }</span>
        </div>
      `
        )
        .join("");
    } catch {}
  }

  // Initialize full UI
  updateUI();
  loadRecent();
  loadFeaturedDeals();
});
