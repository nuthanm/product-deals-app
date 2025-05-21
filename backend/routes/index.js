const express = require('express');
const router = express.Router();

// Import controllers
const autocompleteController = require('../controllers/autocompleteController');
const dealsController = require('../controllers/dealsController');

// Autocomplete route
router.get('/autocomplete', autocompleteController.getAutocompleteResults);

// Deals route
router.post('/deals', dealsController.getProductDeals);

module.exports = router;
