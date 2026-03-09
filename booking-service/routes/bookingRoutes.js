const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();
const CATALOG_URL = process.env.CATALOG_SERVICE_URL || 'http://localhost:3001';

// POST /api/bookings - Reserve a table
router.post('/', async (req, res) => {
  try {
    const { userId, restaurantId, tableType, menuItems, bookingDate } = req.body;

    // 1. SYNCHRONOUS HTTP CALL: Ask Catalog Service for restaurant data
    const catalogResponse = await axios.get(`${CATALOG_URL}/api/restaurants`);
    const restaurants = catalogResponse.data;
    
    // Find the specific restaurant the user wants
    const restaurant = restaurants.find(r => r.id === restaurantId);

    if (!restaurant) {
      return res.status(404).json({ error: '❌ Restaurant not found in Catalog.' });
    }

    // 2. VALIDATION: Check if the requested table type actually exists there
    const tableInfo = restaurant.tables.find(t => t.type === tableType);
    if (!tableInfo) {
      return res.status(400).json({ error: `❌ Table type '${tableType}' is not available at ${restaurant.name}.` });
    }

    // 3. DATABASE SAVE: If validation passes, save to booking_db
    const reservation = await prisma.reservation.create({
      data: {
        userId, 
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        tableType,
        menuItems: menuItems || [], // Optional menu selection per requirements
        bookingDate: new Date(bookingDate)
      }
    });

    res.status(201).json({ 
      message: '✅ Reservation created successfully! (Pending Billing)', 
      reservation 
    });

  } catch (error) {
    console.error('Booking API Error:', error.message);
    res.status(500).json({ error: 'Failed to create reservation' });
  }
});

module.exports = router;