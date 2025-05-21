# Product Deals Finder App

A modern web application that allows users to search for multiple products (up to 5) and find the best shopping deals for each product from across the web.

![image](https://github.com/user-attachments/assets/25423d94-dd2a-4361-a052-32bfdc05c249)

## Features

- **Multi-Product Search**: Search for up to 5 products simultaneously
- **Autocomplete**: Real-time product suggestions as you type
- **Grouped Deals**: All your deals are grouped based on the product
- **Recent Searches**: Quickly access your previous searches
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Result Filtering**: Filter results by source, price, and ratings

## Enhancements
- **Deal Comparison**: View and compare deals from multiple sources
- **Load More**: Pagination support for viewing additional deals

## Tech Stack

### Frontend
- HTML5, CSS3, JavaScript
- Tailwind CSS for styling
- Axios for API requests

### Backend
- Node.js with Express
- MongoDB for database
- SerpAPI integration for product deals
- Redis (optional) for enhanced caching

## Project Structure
```
product-deals-app/
├── src/                  # Frontend code
│   ├── assets/           # JavaScript, CSS, and images
│   │   ├── app.js        # Main application logic
│   │   ├── styles.css    # Custom styles
│   │   └── product-icon.svg # Product icon
│   ├── components/       # UI components
│   ├── index.html        # Main HTML file
│   └── usage_policies.md # Usage policies document
├── backend/              # Backend code
│   ├── controllers/      # API controllers
│   │   ├── autocompleteController.js # Handles product search
│   │   └── dealsController.js        # Handles deal fetching
│   ├── models/           # MongoDB models
│   │   ├── Product.js    # Product schema
│   │   ├── ProductHistory.js # Search history schema
│   │   └── ProductResponse.js # Cached responses schema
│   ├── routes/           # API routes
│   ├── server.js         # Express server
│   └── .env.example      # Environment variables template
├── SETUP.md              # Setup instructions
└── DEPLOYMENT.md         # Deployment guide
```

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/nuthanm/product-deals-app.git
   cd product-deals-app
   ```
2. Set up the backend:
    ```
    cd backend
    npm install
    cp .env.example .env
    # Edit .env with your MongoDB URI and SerpAPI key
   ```
3. Start the application:
   ```
     npm start
   ```
4. To stop the application
   ```
    CTRL + C and press Y
   ```
## API Endpoints
```
GET /api/autocomplete?query=<search_term> - Get autocomplete suggestions
POST /api/deals - Get deals for multiple products (up to 5 )
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| MONGODB_URI | MongoDB connection string | Yes |
| PORT | Server port (default: 3000) | No |
| SERPAPI_KEY | SerpAPI key for fetching deals | Yes |
| REDIS_ENABLED | Enable Redis caching (true/false) | No |
| REDIS_URL | Redis connection string | If Redis enabled |
| ALLOWED_SOURCES | Comma-separated list of allowed sources | No |

### It's time to Gratitude
**Autonomous AI agent**: **[Manus](https://manus.im/)**
