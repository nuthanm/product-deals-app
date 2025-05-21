const mongoose = require('mongoose');

const ProductHistorySchema = new mongoose.Schema({
  products: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  searchDate: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ProductHistory', ProductHistorySchema);
