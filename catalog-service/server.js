const express = require('express');
const cors = require('cors');
require('dotenv').config();

const restaurantRoutes = require('./routes/restaurantRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/restaurants', restaurantRoutes);

// Health check
app.get('/health', (req, res) => {
    console.log('Received health check request');
  res.json({ status: 'Catalog Service is running', db: 'Elasticsearch' });
});

app.listen(PORT, () => {
  console.log(`🚀 Catalog Service running on http://localhost:${PORT}`);
});