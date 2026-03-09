const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const { getChannel } = require('../config/rabbitmq');
const { AppError } = require('../utils/errors');

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
router.post('/', async (req, res, next) => {
  try {
    // SECURITY FIX: Take userId from the session, not the body!
    if (!req.isAuthenticated()) {
      return next(new AppError('❌ You must be logged in to book a table.', 401, 'AUTH_REQUIRED'));
    }
    const userId = req.user.id;
    const { restaurantId, tableType, menuItems, bookingDate } = req.body;

    // 1. SYNCHRONOUS HTTP CALL: Ask Catalog Service for restaurant data
    const catalogResponse = await axios.get(`${CATALOG_URL}/api/restaurants`);
    const restaurants = catalogResponse.data;

    // Find the specific restaurant the user wants
    const restaurant = restaurants.find(r => r.id === restaurantId);

    if (!restaurant) {
      return next(new AppError('❌ Restaurant not found in Catalog.', 404, 'RESTAURANT_NOT_FOUND'));
    }

    // 2. VALIDATION: Check if the requested table type actually exists there
    const tableInfo = restaurant.tables.find(t => t.type === tableType);
    if (!tableInfo) {
      return next(new AppError(
        `❌ Table type '${tableType}' is not available at ${restaurant.name}.`,
        400,
        'TABLE_TYPE_UNAVAILABLE'
      ));
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
      console.log(`📤 [Booking] Event published to queue for reservation`, {
        reservationId: reservation.id,
        userId: reservation.userId,
      });
    }

    console.log('✅ [Booking] Reservation created successfully', {
      reservationId: reservation.id,
      userId: reservation.userId,
      restaurantId: reservation.restaurantId,
    });

    res.status(201).json({
      message: '✅ Reservation created successfully! (Pending Billing)',
      reservation
    });

  } catch (error) {
    console.error('💥 [Booking] Reservation create failed', {
      message: error.message,
      stack: error.stack,
    });
    next(error);
  }
});

/**
 * @swagger
 * /api/bookings/user/me:
 *   get:
 *     summary: Get all reservations for the currently authenticated user
 *     responses:
 *       200:
 *         description: List of reservations
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Failed to fetch bookings
 */
router.get('/user/me', async (req, res, next) => {
  if (!req.isAuthenticated()) {
    return next(new AppError('❌ You must be logged in to view your bookings.', 401, 'AUTH_REQUIRED'));
  }

  try {
    const userId = req.user.id;
    const bookings = await prisma.reservation.findMany({
      where: { userId },
      orderBy: { bookingDate: 'desc' }
    });

    console.log('📄 [Booking] Fetched bookings for user', {
      userId,
      bookingCount: bookings.length,
    });

    res.json(bookings);
  } catch (error) {
    next(error);
  }
});

module.exports = router;