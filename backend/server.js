require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const routes = require('./routes');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

console.log("🟢 Starting server.js...");
console.log("ENV MONGODB_URI:", process.env.MONGODB_URI ? "✅ present" : "❌ missing");

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ API Routes
app.use('/api', routes);

// ✅ Health check route
app.get('/', (req, res) => {
  res.send('🚀 API is running successfully');
});

// ✅ Connect to MongoDB (remove deprecated options)
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("✅ MongoDB connected");

    // ✅ Start server only after DB connection is successful
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err);
    process.exit(1); // Exit if DB fails
  });

// ✅ Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
});
