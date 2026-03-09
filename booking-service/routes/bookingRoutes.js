const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const { getChannel } = require('../config/rabbitmq');

const prisma = new PrismaClient();
const CATALOG_URL = process.env.CATALOG_SERVICE_URL || 'http://localhost:3001';

/**
 * @swagger
 * /api/bookings:
 *   post:
 *     summary: Reserve a table (Requires authentication)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               restaurantId:
 *                 type: string
 *               tableType:
 *                 type: string
 *               menuItems:
 *                 type: array
 *                 items:
 *                   type: object
 *               bookingDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Reservation created successfully
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Restaurant not found
 *       500:
 *         description: Failed to create reservation
 */
router.post('/', async (req, res) => {
  console.log("================ BOOKING DEBUG ================");
  console.log("Headers:", req.headers.cookie);
  console.log("Session ID:", req.sessionID);
  console.log("Session Data:", req.session);
  console.log("User Object:", req.user);
  console.log("Is Authenticated?", req.isAuthenticated());
  console.log("===============================================");

  try {
    // SECURITY FIX: Take userId from the session, not the body!
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: '❌ You must be logged in to book a table.' });
    }
    const userId = req.user.id;
    const { restaurantId, tableType, menuItems, bookingDate } = req.body;

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

    // 4. ASYNCHRONOUS EVENT PUBLISHING (New!)
    const channel = getChannel();
    if (channel) {
      const eventPayload = {
        event: 'ReservationCreated',
        data: reservation
      };
      // RabbitMQ requires messages to be sent as Buffer objects
      channel.sendToQueue('booking_events', Buffer.from(JSON.stringify(eventPayload)));
      console.log(`📤 Event published to queue for reservation: ${reservation.id}`);
    }

    res.status(201).json({
      message: '✅ Reservation created successfully! (Pending Billing)',
      reservation
    });

  } catch (error) {
    console.error('Booking API Error:', error.message);
    res.status(500).json({ error: 'Failed to create reservation' });
  }
});

/**
 * @swagger
 * /api/bookings/user/{userId}:
 *   get:
 *     summary: Get all reservations for a specific user
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of reservations
 *       500:
 *         description: Failed to fetch bookings
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const bookings = await prisma.reservation.findMany({
      where: { userId: req.params.userId },
      orderBy: { bookingDate: 'desc' }
    });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

module.exports = router;