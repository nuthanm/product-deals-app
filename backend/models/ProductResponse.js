const mongoose = require('mongoose');

const ProductResponseSchema = new mongoose.Schema({
  productHistory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductHistory',
    required: false // 🆕 Made this field optional
  },
  products: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    productName: String,
    deals: [{
      title: String,
      link: String,
      image: String,
      price: String,
      source: String,
      rating: Number,
      reviews: Number,
      shipping: String,
      fetchedAt: { type: Date, default: Date.now }  // 🆕 New field to track when we fetched it from Serp API

    }]
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: function() {
      // Set expiration to 24 hours from now
      const date = new Date();
      date.setHours(date.getHours() + 24);
      return date;
    }
  }
});

// Create index for expiration
ProductResponseSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('ProductResponse', ProductResponseSchema);
