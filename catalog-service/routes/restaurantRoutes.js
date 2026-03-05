const express = require('express');
const router = express.Router();
const client = require('../config/elasticClient');

const INDEX_NAME = 'restaurants';

// GET /api/restaurants - Browse all restaurants or search by name
router.get('/', async (req, res) => {
    console.log('Received request to fetch restaurants with query:', req.query);
  try {
    const { search } = req.query;
    
    let query = { match_all: {} };
    
    if (search) {
      query = {
        match: { name: search }
      };
    }

    const result = await client.search({
      index: INDEX_NAME,
      body: { query }
    });

    // Map through the hits to return clean JSON to the frontend/Postman
    const restaurants = result.hits.hits.map(hit => ({
      id: hit._id,
      ...hit._source
    }));

    res.json(restaurants);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch restaurants' });
  }
});

// POST /api/restaurants/seed - Helper to inject dummy data
router.post('/seed', async (req, res) => {
    console.log('Received request to seed dummy restaurant data');
  try {
    const dummyData = [
      {
        name: "The Code Cafe",
        location: "Tech Park",
        tables: [{ type: "Window", capacity: 2, count: 5 }],
        menu: [{ itemName: "Coffee", price: 3.50 }]
      },
      {
        name: "Dev Diner",
        location: "Downtown",
        tables: [{ type: "Booth", capacity: 4, count: 10 }],
        menu: [{ itemName: "Burger", price: 12.00 }]
      }
    ];

    for (const doc of dummyData) {
      await client.index({
        index: INDEX_NAME,
        document: doc
      });
    }
    
    // Force a refresh so data is searchable immediately
    await client.indices.refresh({ index: INDEX_NAME });

    res.json({ message: '✅ Dummy data seeded successfully!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to seed data' });
  }
});

module.exports = router;