const express = require('express');
const router = express.Router();
const client = require('../config/elasticClient');

const INDEX_NAME = 'restaurants';

/**
 * @swagger
 * /api/restaurants:
 *   get:
 *     summary: Browse all restaurants or search by name
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Name of the restaurant to search for
 *     responses:
 *       200:
 *         description: A list of restaurants
 *       500:
 *         description: Failed to fetch restaurants
 */
router.get('/', async (req, res) => {
  console.log(
    'Received request to fetch restaurants with query:',JSON.stringify(req.query || {}, null, 2));
  try {
    const { search } = req.query;

    let query = { match_all: {} };

    if (search) {
      query = {
        bool: {
          should: [
            { match: { name: { query: search, fuzziness: "AUTO" } } },
            { wildcard: { name: `*${search.toLowerCase()}*` } }
          ]
        }
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

/**
 * @swagger
 * /api/restaurants/seed:
 *   post:
 *     summary: Seed dummy restaurant data into Elasticsearch
 *     responses:
 *       200:
 *         description: Dummy data seeded successfully
 *       500:
 *         description: Failed to seed data
 */
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