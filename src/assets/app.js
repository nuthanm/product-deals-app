// Main application JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const productSearch = document.getElementById('product-search');
    const addToListBtn = document.getElementById('add-to-list');
    const autocompleteResults = document.getElementById('autocomplete-results');
    const selectedProducts = document.getElementById('selected-products');
    const emptyState = document.getElementById('empty-state');
    const productCount = document.getElementById('product-count');
    const getDealsBtn = document.getElementById('get-deals');
    const dealsResults = document.getElementById('deals-results');
    const dealsContainer = document.getElementById('deals-container');
    const errorToast = document.getElementById('error-toast');
    const errorMessage = document.getElementById('error-message');
    const successToast = document.getElementById('success-toast');
    const successMessage = document.getElementById('success-message');
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingMessage = document.getElementById('loading-message');
    const recentSearches = document.getElementById('recent-searches');
    const clearHistoryBtn = document.getElementById('clear-history');
    
    // Refresh page on click of page logo
    // This is the title-refresh element that acts as a logo
    document.getElementById('title-refresh').addEventListener('click', function () {
        location.reload();
    });

    // Variables
    let paginationTracker = {}; // track start index per product
    let productList = [];
    let typingTimer;
    const MAX_PRODUCTS = 5;
    const TYPING_INTERVAL = 300; // ms
    //const API_BASE_URL = 'http://localhost:3000/api'; // Will be replaced with actual API URL in production
//    const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';
    // const API_BASE_URL = window.API_BASE_URL || 'http://localhost:3000';
    const API_BASE_URL = window.API_BASE_URL || 'https://product-deals-app-production.up.railway.app/api';
    // console.log(window.API_BASE_URL);
    //console.log("API BASE URL value", API_BASE_URL);

    if (!window.API_BASE_URL) {
        console.warn("window.API_BASE_URL is not set — using default fallback!");
    }

    // Initialize
    init();
    
    function init() {
        // Set up event listeners
        setupEventListeners();
        
        // Load recent searches
        loadRecentSearches();
    }
    
    function setupEventListeners() {
        // Search input events
        productSearch.addEventListener('input', handleSearchInput);
        productSearch.addEventListener('focus', function() {
            if (productSearch.value.trim().length > 0) {
                fetchAutocompleteResults(productSearch.value.trim());
            }
        });
        
        // Add to list button
        addToListBtn.addEventListener('click', addProductToList);
        
        // Get deals button
        getDealsBtn.addEventListener('click', getProductDeals);
        
        // Clear history button
        clearHistoryBtn.addEventListener('click', clearSearchHistory);
        
        // Close autocomplete when clicking outside
        document.addEventListener('click', function(e) {
            if (!productSearch.contains(e.target) && !autocompleteResults.contains(e.target)) {
                autocompleteResults.classList.add('hidden');
            }
        });
    }
    
    // Handle search input with debounce
    function handleSearchInput() {
        clearTimeout(typingTimer);
        
        const query = productSearch.value.trim();
        if (query.length > 2) {
            typingTimer = setTimeout(() => {
                fetchAutocompleteResults(query);
            }, TYPING_INTERVAL);
        } else {
            autocompleteResults.classList.add('hidden');
        }
    }
    
    // Fetch autocomplete results from API
    async function fetchAutocompleteResults(query) {
    try {
        // Remove this line that shows loading:
        // showLoading('Searching products...');
        
        // Add a subtle indicator instead (optional)
        productSearch.classList.add('searching');
        
        const response = await axios.get(`${API_BASE_URL}/autocomplete?query=${encodeURIComponent(query)}`);
        
        // Remove this line that hides loading:
        // hideLoading();
        
        // Remove the subtle indicator
        productSearch.classList.remove('searching');
        
        if (response.data && response.data.length > 0) {
            displayAutocompleteResults(response.data);
        } else {
            autocompleteResults.innerHTML = '<div class="p-3 text-gray-500 text-center">No products found</div>';
            autocompleteResults.classList.remove('hidden');
        }
    } catch (error) {
        // Remove this line:
        // hideLoading();
        
        // Remove the subtle indicator
        productSearch.classList.remove('searching');
        
        console.error('Error fetching autocomplete results:', error);
        // Don't show error for autocomplete - it's too disruptive
        // showError('Failed to fetch product suggestions. Please try again.');
    }
}

   async function loadMoreDeals(productName, sectionElement) {
  const currentStart = paginationTracker[productName] || 10;

  try {
    const response = await axios.post(`${API_BASE_URL}/deals?start=${currentStart}`, {
      products: [{ name: productName }]
    });

    const newDeals = response.data[0]?.deals || [];
    paginationTracker[productName] = currentStart + newDeals.length;

    const grid = sectionElement.querySelector('.grid');

    // If no new deals
    if (newDeals.length === 0) {
      // Remove Load More button if present
      const loadMoreBtn = sectionElement.querySelector('.load-more-button');
      if (loadMoreBtn) loadMoreBtn.remove();

      // Show no-more-results message (once)
      if (!sectionElement.querySelector('.no-more-message')) {
        const message = document.createElement('div');
        message.className = 'no-more-message animate-fade-in text-center text-sm text-indigo-500 mt-4 italic';
        message.innerHTML = `<i class="fas fa-info-circle mr-1"></i> No more results found.`;
        sectionElement.appendChild(message);
      }

      return;
    }

    // Append new deals
    grid.innerHTML += newDeals.map(deal => buildDealCard(deal)).join('');

    // Remove any existing Load More button
    const oldLoadMoreBtn = sectionElement.querySelector('.load-more-button');
    if (oldLoadMoreBtn) oldLoadMoreBtn.remove();

    // Add Load More button only if exactly 10 results returned
    if (newDeals.length === 10) {
      const loadMoreBtn = document.createElement('button');
      loadMoreBtn.className = 'load-more-button mt-4 w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700';
      loadMoreBtn.textContent = 'Load More';
      loadMoreBtn.addEventListener('click', () =>
        loadMoreDeals(productName, sectionElement)
      );
      sectionElement.appendChild(loadMoreBtn);
    }
  } catch (error) {
    console.error('Load more error:', error);
    showError('Failed to load more deals.');
  }
}


function buildDealCard(deal) {
  return `
    <a href="${deal.link}" target="_blank" class="product-item block bg-white rounded-lg border border-gray-200 overflow-hidden hover:border-indigo-300">
      <div class="h-48 bg-gray-100 flex items-center justify-center">
        <img src="${deal.image || './assets/placeholder.png'}" alt="${deal.title}" class="max-h-full max-w-full object-contain">
      </div>
      <div class="p-4">
        <div class="flex items-center mb-2">
          <div class="text-yellow-400 flex">${generateStarRating(deal.rating || 0)}</div>
          <span class="text-sm text-gray-600 ml-1">${deal.rating || '0'} ${deal.reviews ? `(${deal.reviews} reviews)` : ''}</span>
        </div>
        <h5 class="font-medium text-gray-800 mb-1">${deal.title}</h5>
        <p class="text-gray-500 text-sm mb-2">${deal.source || 'Online Store'}</p>
        <div class="flex justify-between items-center">
          <span class="text-lg font-bold text-indigo-600">${deal.price || 'Price unavailable'}</span>
          <span class="text-sm text-green-600">${deal.shipping || ''}</span>
        </div>
      </div>
    </a>
  `;
}


    // Display autocomplete results
    function displayAutocompleteResults(results) {
        autocompleteResults.innerHTML = '';
        
        results.forEach(product => {
            const item = document.createElement('div');
            item.className = 'p-3 border-b border-gray-200 hover:bg-gray-100 cursor-pointer';
            item.innerHTML = `
                <div class="font-medium">${product.name}</div>                
            `;
            
            item.addEventListener('click', () => {
                productSearch.value = product.name;
                autocompleteResults.classList.add('hidden');
                
                // If product has an ID, store it
                if (product.id) {
                    productSearch.dataset.productId = product.id;
                }
            });
            
            autocompleteResults.appendChild(item);
        });
        
        autocompleteResults.classList.remove('hidden');
    }
    
    // Add product to list
    function addProductToList() {
        const productName = productSearch.value.trim();
        const productId = productSearch.dataset.productId || null;
        
        if (!productName) {
            showError('Please enter a product name.');
            return;
        }
        
        if (productList.length >= MAX_PRODUCTS) {
            showError(`Maximum ${MAX_PRODUCTS} products allowed. Remove a product to add more.`);
            return;
        }
        
        // Check for duplicates
        if (productList.some(p => p.name.toLowerCase() === productName.toLowerCase())) {
            showError('This product is already in your list.');
            return;
        }
        
        // Add to list
        productList.push({
            id: productId,
            name: productName
        });
        
        // Update UI
        updateProductList();
        
        // Clear search
        productSearch.value = '';
        productSearch.dataset.productId = '';
        autocompleteResults.classList.add('hidden');
        
        // Show success message
        showSuccess('Product added to list!');
    }
    
    // Update product list UI
    function updateProductList() {
        // Update count
        productCount.textContent = `(${productList.length}/${MAX_PRODUCTS})`;
        
        // Clear current list (except empty state)
        const items = selectedProducts.querySelectorAll('.product-item');
        items.forEach(item => item.remove());
        
        // Show/hide empty state
        if (productList.length > 0) {
            emptyState.classList.add('hidden');
            getDealsBtn.classList.remove('hidden');
        } else {
            emptyState.classList.remove('hidden');
            getDealsBtn.classList.add('hidden');
        }
        
        // Add products to list
        productList.forEach((product, index) => {
            const productItem = document.createElement('div');
            productItem.className = 'product-item flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-200';
            productItem.innerHTML = `
                <div>
                    <span class="font-medium">${product.name}</span>
                </div>
                <button class="text-red-500 hover:text-red-700 transition" data-index="${index}">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            // Add remove event listener
            const removeBtn = productItem.querySelector('button');
            removeBtn.addEventListener('click', function () {
                const index = parseInt(this.getAttribute('data-index'));
                const removedProduct = productList[index].name.toLowerCase();

                // Remove product from list
                productList.splice(index, 1);
                updateProductList();

                // Remove corresponding section from deals grid if it exists
                const dealSections = dealsContainer.querySelectorAll('.product-deals');
                dealSections.forEach(section => {
                    const heading = section.querySelector('h4');
                    if (heading && heading.textContent.trim().toLowerCase() === removedProduct) {
                        section.remove();
                    }
            });

            // Hide entire deals-results section if no sections are left
            if (dealsContainer.querySelectorAll('.product-deals').length === 0) {
                dealsResults.classList.add('hidden');
            }
        });
            
            selectedProducts.appendChild(productItem);
        });
        
        // Update add button state
        if (productList.length >= MAX_PRODUCTS) {
            addToListBtn.disabled = true;
            addToListBtn.classList.add('bg-gray-400');
            addToListBtn.classList.remove('bg-indigo-700', 'hover:bg-indigo-800');
            addToListBtn.setAttribute('title', 'You can only add up to 5 products.');
        } else {
            addToListBtn.disabled = false;
            addToListBtn.classList.remove('bg-gray-400');
            addToListBtn.classList.add('bg-indigo-700', 'hover:bg-indigo-800');
            addToListBtn.removeAttribute('title');
        }
    }
    
    // Get product deals
    async function getProductDeals() {
        if (productList.length === 0) {
            showError('Please add at least one product to the list.');
            return;
        }
        
        try {
            // Show loading
            showLoading('Finding the best deals for your products...');
            getDealsBtn.disabled = true;
            getDealsBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Finding Deals...';
            
            // Prepare data
            const products = productList.map(p => ({
                id: p.id,
                name: p.name
            }));
            
            // Call API - Fetch always starts with 0
            const response = await axios.post(`${API_BASE_URL}/deals?start=0`, {
                  products
            });

            // Hide loading
            hideLoading();
            getDealsBtn.disabled = false;
            getDealsBtn.innerHTML = '<i class="fas fa-search-dollar mr-2"></i> Get Product(s) Deals';
            
            // Display results
            displayDeals(response.data);
            
            // Add to recent searches
            addToRecentSearches(products);
            
            // Show success
            showSuccess('Found deals for your products!');
            
            // Scroll to results
            dealsResults.scrollIntoView({ behavior: 'smooth' });
        } catch (error) {
            // Hide loading
            hideLoading();
            getDealsBtn.disabled = false;
            getDealsBtn.innerHTML = '<i class="fas fa-search-dollar mr-2"></i> Get Product(s) Deals';
            
            console.error('Error fetching deals:', error);
            showError('Failed to fetch product deals. Please try again.');
        }
    }
    
    // Newer version - Groupin Display deals
    let cartItems = [];
    function displayDeals(dealsData) {
  const dealsContainer = document.getElementById('deals-container');
  dealsContainer.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6';

  dealsData.forEach(productData => {
    const grouped = groupByNormalizedTitle(productData.deals);

    Object.entries(grouped).forEach(([groupKey, deals]) => {
      const section = document.createElement('div');
      section.className = "product-deals mb-6 p-4 border rounded shadow-sm bg-white";
      section.setAttribute("data-product", productData.product.name.toLowerCase());

      const best = findBestValue(deals);

      if (deals.length > 1) {
        section.innerHTML = `
          <h4 class="text-lg font-semibold mb-2">${groupKey}</h4>
          <div class="space-y-4">
            ${deals.map(deal => `
              <div class="border rounded-lg p-3 flex gap-4 items-center ${deal === best ? 'border-green-500 bg-green-50' : 'border-gray-200'}">
                <div class="w-24 h-24 bg-white flex items-center justify-center border rounded">
                  <img src="${deal.image || './assets/placeholder.png'}" alt="${deal.title}" class="max-h-full max-w-full object-contain">
                </div>
                <div class="flex-1">
                  <div class="font-semibold">${deal.source}</div>
                  <div class="text-sm text-gray-500">${deal.title}</div>
                  ${deal === best ? '<div class="text-xs font-bold text-green-600 mt-1">✅ BEST VALUE</div>' : ''}
                  <div class="mt-2 flex justify-between items-center">
                    <div class="text-indigo-600 font-bold">${deal.price}</div>
                    <button class="bg-indigo-600 text-white text-sm px-3 py-1 rounded add-to-cart-btn" data-deal='${JSON.stringify(deal)}'>Add to List</button>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        `;
      } else {
        const deal = deals[0];
        section.innerHTML = `
          <h4 class="text-lg font-semibold mb-2">${groupKey}</h4>
          <div class="flex gap-4 border p-4 rounded bg-yellow-50 border-yellow-300 items-center">
            <div class="w-24 h-24 bg-white flex items-center justify-center rounded border">
              <img src="${deal.image || './assets/placeholder.png'}" alt="${deal.title}" class="max-h-full max-w-full object-contain">
            </div>
            <div class="flex-1">
              <div class="font-medium text-gray-800">${deal.source}</div>
              <div class="text-sm text-gray-600">${deal.title}</div>
              <div class="text-xs text-yellow-700 mt-1">No other sources available for comparison.</div>
              <div class="mt-2 flex justify-between items-center">
                <div class="font-bold text-indigo-600 text-lg">${deal.price}</div>
                <button class="bg-indigo-600 text-white px-3 py-1 rounded add-to-cart-btn" data-deal='${JSON.stringify(deal)}'>Add to List</button>
              </div>
            </div>
          </div>
        `;
      }

      wrapper.appendChild(section);
    });
  });

  dealsContainer.appendChild(wrapper);
  const resultsBlock = document.getElementById('deals-results');
  resultsBlock.classList.remove('hidden');
}



function normalizeTitleQuantity(title) {
  const match = title.match(/(\d+(\.\d+)?)(\s*)(ml|l|g|kg|pieces|pcs|dozen|each)/i);
  if (!match) {
    if (/each/i.test(title)) return { qty: 1, unit: "piece" };
    return { qty: "unknown", unit: "unit" };
  }

  let qty = parseFloat(match[1]);
  let unit = match[4].toLowerCase();

  if (unit === "ml") { qty = qty / 1000; unit = "L"; }
  else if (unit === "g") { qty = qty / 1000; unit = "kg"; }
  else if (unit === "pcs" || unit === "piece") { unit = "pieces"; }
  else if (unit === "dozen") { qty = qty * 12; unit = "pieces"; }

  return { qty: qty.toFixed(2), unit };
}

function extractNormalizedName(title) {
  return title.replace(/(Coles|Woolworths|Amazon|Fresh|Organic|Supermarkets)/gi, '')
              .trim().split(' ').slice(0, 3).join(' ');
}
function groupByNormalizedTitle(deals) {
  const map = {};
  deals.forEach(deal => {
    const { qty, unit } = normalizeTitleQuantity(deal.title);
    const name = extractNormalizedName(deal.title);
    const key = `${name} – ${qty} ${unit}`;
    if (!map[key]) map[key] = [];
    map[key].push(deal);
  });
  return map;
}

function findBestValue(deals) {
  return deals.reduce((a, b) =>
    parseFloat(a.price.replace(/[^0-9.]/g, '')) < parseFloat(b.price.replace(/[^0-9.]/g, '')) ? a : b,
    deals[0]
  );
}

document.addEventListener('click', e => {
  if (e.target.classList.contains('add-to-cart-btn')) {
    const deal = JSON.parse(e.target.dataset.deal);
    cartItems.push(deal);
    updateCartOverlay();
  }
});

function updateCartOverlay() {
  const overlay = document.getElementById('cart-overlay');
  const list = document.getElementById('cart-items-list');
  list.innerHTML = cartItems.map(item => `
    <div class="text-sm border-b py-2">${item.title} – ${item.price}</div>
  `).join('');
  overlay.classList.remove('hidden');
}

function goToCart() {
  const summary = document.getElementById('cart-summary');
  const list = document.getElementById('cart-summary-list');

  list.innerHTML = cartItems.map(item => `
    <div class="border-b py-2">${item.title} – <strong>${item.price}</strong> from ${item.source}</div>
  `).join('');

  summary.classList.remove('hidden');
}

//     function displayDeals(dealsData) {
//     const dealsResults = document.getElementById('deals-results');
//     const dealsContainer = document.getElementById('deals-container');

//     // Clear previous results
//     dealsContainer.innerHTML = '';

//     // Check if all products have no deals
//     const noDealsFound = !dealsData || dealsData.length === 0 || dealsData.every(d => !d.deals || d.deals.length === 0);

//     if (noDealsFound) {
//         dealsResults.classList.add('hidden'); // ❌ Don't show the block at all
//         return;
//     }

//     // Loop through each product and show results
//     dealsData.forEach(productDeals => {
//         const productSection = document.createElement('div');
//         productSection.className = 'product-deals animate-fade-in';

//         let dealsHtml = '';

//         if (productDeals.deals && productDeals.deals.length > 0) {
//             dealsHtml = `
//                 <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
//                     ${productDeals.deals.map(deal => `
//                         <a href="${deal.link}" target="_blank" class="product-item block bg-white rounded-lg border border-gray-200 overflow-hidden hover:border-indigo-300">
//                             <div class="h-48 bg-gray-100 flex items-center justify-center">
//                                 <img src="${deal.image || './assets/placeholder.png'}" alt="${deal.title}" class="max-h-full max-w-full object-contain">
//                             </div>
//                             <div class="p-4">
//                                 <div class="flex items-center mb-2">
//                                     <div class="text-yellow-400 flex">
//                                         ${generateStarRating(deal.rating || 0)}
//                                     </div>
//                                     <span class="text-sm text-gray-600 ml-1">${deal.rating || '0'} ${deal.reviews ? `(${deal.reviews} reviews)` : ''}</span>
//                                 </div>
//                                 <h5 class="font-medium text-gray-800 mb-1">${deal.title}</h5>
//                                 <p class="text-gray-500 text-sm mb-2">${deal.source || 'Online Store'}</p>
//                                 <div class="flex justify-between items-center">
//                                     <span class="text-lg font-bold text-indigo-600">${deal.price || 'Price unavailable'}</span>
//                                     <span class="text-sm text-green-600">${deal.shipping || ''}</span>
//                                 </div>
//                             </div>
//                         </a>
//                     `).join('')}
//                 </div>
//             `;
//         } else {
//             // Show product name with no results
//             dealsHtml = `
//                 <div class="text-center py-4 text-gray-500">
//                     <p>No deals found for <strong>${productDeals.product.name}</strong>.</p>
//                 </div>
//             `;
//         }

//         productSection.innerHTML = `
//             <h4 class="text-lg font-medium mb-3 pb-2 border-b border-gray-200">${productDeals.product.name}</h4>
//             ${dealsHtml}
//         `;

//         // Only show "Load More" if there are initial results
//         if (productDeals.deals && productDeals.deals.length > 0) {
//             const loadMoreBtn = document.createElement('button');
//             loadMoreBtn.className = 'mt-4 w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700';
//             loadMoreBtn.textContent = 'Load More';
//             loadMoreBtn.addEventListener('click', () =>
//                 loadMoreDeals(productDeals.product.name, productSection)
//             );
//             productSection.appendChild(loadMoreBtn);
//         }

//         dealsContainer.appendChild(productSection);
//     });

//     // ✅ Now finally show the container only if there was something to show
//     dealsResults.classList.remove('hidden');
//     dealsResults.classList.add('animate-fade-in');
// }

    
    // Generate star rating HTML
    function generateStarRating(rating) {
        const fullStars = Math.floor(rating);
        const halfStar = rating % 1 >= 0.5;
        const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
        
        let starsHtml = '';
        
        // Full stars
        for (let i = 0; i < fullStars; i++) {
            starsHtml += '<i class="fas fa-star"></i>';
        }
        
        // Half star
        if (halfStar) {
            starsHtml += '<i class="fas fa-star-half-alt"></i>';
        }
        
        // Empty stars
        for (let i = 0; i < emptyStars; i++) {
            starsHtml += '<i class="far fa-star"></i>';
        }
        
        return starsHtml;
    }
    
    // Add to recent searches
    function addToRecentSearches(products) {
        // Get existing searches from localStorage
        let recentSearches = JSON.parse(localStorage.getItem('recentSearches')) || [];
        
        // Check if we have multiple products
    if (products.length > 1) {
        // Create a group entry
        const primaryProduct = products[0];
        const groupEntry = {
            id: primaryProduct.id,
            name: primaryProduct.name,
            additionalCount: products.length - 1,
            groupProducts: products
        };
        
        // Remove any existing entries with these products
        recentSearches = recentSearches.filter(item => {
            if (item.groupProducts) {
                // Check if this is a similar group
                const groupProductIds = item.groupProducts.map(p => p.id);
                const currentProductIds = products.map(p => p.id);
                const hasOverlap = groupProductIds.some(id => currentProductIds.includes(id));
                return !hasOverlap;
            }
            return !products.some(p => p.id === item.id || p.name === item.name);
        });
        
        // Add group to beginning of array
        recentSearches.unshift(groupEntry);
    } else {
        // Original single product logic
        const product = products[0];
        
        // Check if already exists
        const existingIndex = recentSearches.findIndex(p => 
            p.id === product.id || p.name.toLowerCase() === product.name.toLowerCase()
        );
        
        if (existingIndex !== -1) {
            // Remove existing entry
            recentSearches.splice(existingIndex, 1);
        }
        
        // Add to beginning of array
        recentSearches.unshift(product);
    }
    
    // Limit to 10 recent searches
    recentSearches = recentSearches.slice(0, 10);
    
    // Save to localStorage
    localStorage.setItem('recentSearches', JSON.stringify(recentSearches));
    
    // Update UI
    loadRecentSearches();
    
    }
    
    // Load recent searches
    function loadRecentSearches() {
        const searches = JSON.parse(localStorage.getItem('recentSearches')) || [];
    
        recentSearches.innerHTML = '';
    
    if (searches.length === 0) {
        recentSearches.innerHTML = `
            <div class="col-span-full text-center py-4 text-gray-500">
                <p>No recent searches yet.</p>
            </div>
        `;
        return;
    }
    
    searches.forEach((product, index) => {
        const item = document.createElement('div');
        item.className = 'product-item bg-gray-50 rounded-lg p-3 border border-gray-200 relative';
        
        // Check if this is a group entry
        const isGroup = product.additionalCount > 0;
        
        item.innerHTML = `
            <button class="delete-search absolute top-2 right-2 text-gray-400 hover:text-red-500 transition" data-index="${index}">
                <i class="fas fa-times-circle"></i>
            </button>
            <div class="text-center pt-2">
                <div class="text-sm font-medium mb-1 truncate">
                    ${product.name}
                    ${isGroup ? `<span class="ml-1 bg-indigo-100 text-indigo-800 text-xs px-2 py-0.5 rounded-full">+${product.additionalCount}</span>` : ''}
                </div>
                <button class="find-deals text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full hover:bg-indigo-200 transition">
                    Find Deals
                </button>
            </div>
        `;
        
        // Add event listeners
        const deleteBtn = item.querySelector('.delete-search');
        deleteBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            deleteRecentSearch(parseInt(this.getAttribute('data-index')));
        });
        
        const findDealsBtn = item.querySelector('.find-deals');
        findDealsBtn.addEventListener('click', function() {
            if (isGroup) {
                // Add all products in the group
                product.groupProducts.forEach(p => addToListFromRecent(p));
            } else {
                addToListFromRecent(product);
            }
        });
        
        recentSearches.appendChild(item);
    });
    }
    
    // Delete recent search
    function deleteRecentSearch(index) {
        let searches = JSON.parse(localStorage.getItem('recentSearches')) || [];
        
        if (index >= 0 && index < searches.length) {
            searches.splice(index, 1);
            localStorage.setItem('recentSearches', JSON.stringify(searches));
            loadRecentSearches();
        }
    }
    
    // Clear search history
    function clearSearchHistory() {
        localStorage.removeItem('recentSearches');
        loadRecentSearches();
        showSuccess('Search history cleared.');
    }
    
    // Add to list from recent searches
    function addToListFromRecent(product) {
        if (productList.length >= MAX_PRODUCTS) {
            showError(`Maximum ${MAX_PRODUCTS} products allowed. Remove a product to add more.`);
            return;
        }
        
        // Check for duplicates
        if (productList.some(p => p.name.toLowerCase() === product.name.toLowerCase())) {
            showError('This product is already in your list.');
            return;
        }
        
        // Add to list
        productList.push({
            id: product.id,
            name: product.name
        });
        
        // Update UI
        updateProductList();
        
        // Show success message
        showSuccess('Product added to list!');
    }
    
    // Show error toast
    function showError(message) {
        errorMessage.textContent = message;
        errorToast.classList.remove('hidden');
        
        // Hide after 3 seconds
        setTimeout(() => {
            errorToast.classList.add('hidden');
        }, 3000);
    }
    
    // Show success toast
    function showSuccess(message) {
        successMessage.textContent = message;
        successToast.classList.remove('hidden');
        
        // Hide after 3 seconds
        setTimeout(() => {
            successToast.classList.add('hidden');
        }, 3000);
    }
    
    // Show loading overlay
    function showLoading(message = 'Loading...') {
        loadingMessage.textContent = message;
        loadingOverlay.classList.remove('hidden');
    }
    
    // Hide loading overlay
    function hideLoading() {
        loadingOverlay.classList.add('hidden');
    }

    // Move to Top logic
    const moveToTopBtn = document.getElementById('move-to-top');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            moveToTopBtn.classList.remove('hidden');
        } else {
            moveToTopBtn.classList.add('hidden');
        }
    });

    moveToTopBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
    });
});
});
