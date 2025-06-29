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
    
    // Variables
    let paginationTracker = {}; // track start index per product
    let productList = [];
    let typingTimer;
    const MAX_PRODUCTS = 5;
    const TYPING_INTERVAL = 300; // ms
    //const API_BASE_URL = '/api'; // Will be replaced with actual API URL in production
//    const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';
    // const API_BASE_URL = window.API_BASE_URL || 'http://localhost:3000';
    const API_BASE_URL = window.API_BASE_URL || 'https://product-deals-app-production.up.railway.app/api';
    console.log(window.API_BASE_URL);
    console.log("API BASE URL value", API_BASE_URL);

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
              const response = await axios.post(`/api/deals?start=${currentStart}`, {
                  products: [{ name: productName }]
              });

             const newDeals = response.data[0]?.deals || [];
             paginationTracker[productName] = currentStart + newDeals.length;

             if (newDeals.length > 0) {
                  const grid = sectionElement.querySelector('.grid');
                  grid.innerHTML += newDeals.map(deal => `
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
                  `).join('');
                } else {
                  alert('No more results found.');
                }
                } catch (error) {
                    console.error('Load more error:', error);
                    showError('Failed to load more deals.');
                }
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
            removeBtn.addEventListener('click', function() {
                const index = parseInt(this.getAttribute('data-index'));
                productList.splice(index, 1);
                updateProductList();
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
    
    // Display deals
    function displayDeals(dealsData) {
    dealsContainer.innerHTML = '';

    if (!dealsData || dealsData.length === 0) {
        dealsContainer.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <i class="fas fa-search text-4xl mb-3 opacity-30"></i>
                <p>No deals found for your products. Try different products or check back later.</p>
            </div>
        `;
        dealsResults.classList.remove('hidden');
        return;
    }

    dealsData.forEach(productDeals => {
        const productSection = document.createElement('div');
        productSection.className = 'product-deals animate-fade-in';

        let dealsHtml = '';

        if (productDeals.deals && productDeals.deals.length > 0) {
            dealsHtml = `
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    ${productDeals.deals.map(deal => `
                        <a href="${deal.link}" target="_blank" class="product-item block bg-white rounded-lg border border-gray-200 overflow-hidden hover:border-indigo-300">
                            <div class="h-48 bg-gray-100 flex items-center justify-center">
                                <img src="${deal.image || './assets/placeholder.png'}" alt="${deal.title}" class="max-h-full max-w-full object-contain">
                            </div>
                            <div class="p-4">
                                <div class="flex items-center mb-2">
                                    <div class="text-yellow-400 flex">
                                        ${generateStarRating(deal.rating || 0)}
                                    </div>
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
                    `).join('')}
                </div>
            `;
        } else {
            dealsHtml = `
                <div class="text-center py-4 text-gray-500">
                    <p>No deals found for this product. Try a different search term.</p>
                </div>
            `;
        }

        productSection.innerHTML = `
            <h4 class="text-lg font-medium mb-3 pb-2 border-b border-gray-200">${productDeals.product.name}</h4>
            ${dealsHtml}
        `;

        // ✅ Add Load More button INSIDE the loop for each product
        const loadMoreBtn = document.createElement('button');
        loadMoreBtn.className = 'mt-4 w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700';
        loadMoreBtn.textContent = 'Load More';
        loadMoreBtn.addEventListener('click', () =>
            loadMoreDeals(productDeals.product.name, productSection)
        );

        productSection.appendChild(loadMoreBtn);
        dealsContainer.appendChild(productSection);
    });

    dealsResults.classList.remove('hidden');
}

    
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
});
