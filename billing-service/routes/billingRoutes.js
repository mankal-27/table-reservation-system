const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const amqp = require('amqplib');
const { AppError } = require('../utils/errors');

const prisma = new PrismaClient();
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';

/**
 * @swagger
 * /api/billing/{reservationId}:
 *   get:
 *     summary: View the bill for a specific reservation
 *     parameters:
 *       - in: path
 *         name: reservationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Bill data
 *       404:
 *         description: Bill not found
 *       500:
 *         description: Failed to fetch bill
 */
router.get('/:reservationId', async (req, res, next) => {
  try {
    const bill = await prisma.bill.findUnique({
      where: { reservationId: req.params.reservationId }
    });

    if (!bill) {
      return next(new AppError('Bill not found', 404, 'BILL_NOT_FOUND'));
    }
    res.json(bill);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/billing/{id}/pay:
 *   post:
 *     summary: Pay a bill (Requires ownership)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Bill paid successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not authorized to pay this bill
 *       500:
 *         description: Payment failed
 */
router.post('/:reservationId/pay', async (req, res, next) => {
  try {
    // The client may send either reservationId OR billId here.
    const identifier = req.params.reservationId;

    // SECURITY FIX: Check authentication and ownership
    if (!req.isAuthenticated()) {
      return next(new AppError('❌ You must be logged in to pay a bill.', 401, 'AUTH_REQUIRED'));
    }

    console.log('💳 [Billing] Pay request received', {
      pathParam: identifier,
      userId: req.user && req.user.id,
    });

    // Try to resolve bill by reservationId first (normal flow)
    let bill = await prisma.bill.findUnique({ where: { reservationId: identifier } });

    // If not found, treat the identifier as a direct billId (backwards compatibility)
    if (!bill) {
      bill = await prisma.bill.findUnique({ where: { id: identifier } });
    }

    if (!bill) {
      return next(new AppError('Bill not found', 404, 'BILL_NOT_FOUND'));
    }

    // Prevent duplicate payments
    if (bill.status === 'PAID') {
      console.log('⚠️ [Billing] Duplicate pay attempt on already paid bill', {
        reservationId: bill.reservationId,
        billId: bill.id,
        userId: req.user && req.user.id,
      });
      return next(new AppError('This bill has already been paid.', 400, 'BILL_ALREADY_PAID'));
    }

    if (bill.userId !== req.user.id) {
      return next(new AppError('❌ You are not authorized to pay this bill.', 403, 'BILL_FORBIDDEN'));
    }

    // 1. Update the database
    const updatedBill = await prisma.bill.update({
      where: { id: bill.id },
      data: { status: 'PAID' }
    });
    // 2. Publish "BillPaid" event to RabbitMQ
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();
    await channel.assertQueue('notification_events', { durable: true });

    const eventPayload = {
      event: 'BillPaid',
      data: {
        ...updatedBill,
        userEmail: req.user.email // Include email for notification-service
      }
    };
    channel.sendToQueue('notification_events', Buffer.from(JSON.stringify(eventPayload)));
    console.log(`📤 'BillPaid' event published for Bill ID: ${updatedBill.id}`);

    // Close the connection gracefully
    setTimeout(() => { connection.close(); }, 500);

    console.log('✅ [Billing] Bill paid successfully', {
      reservationId: updatedBill.reservationId,
      billId: updatedBill.id,
      userId: updatedBill.userId,
      status: updatedBill.status,
    });

    res.json({ message: '💸 Bill paid successfully!', bill: updatedBill });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/billing/user/me:
 *   get:
 *     summary: Get all bills for the currently authenticated user
 *     responses:
 *       200:
 *         description: List of bills
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Failed to fetch bills
 */
router.get('/user/me', async (req, res, next) => {
  if (!req.isAuthenticated()) {
    return next(new AppError('❌ You must be logged in to view your bills.', 401, 'AUTH_REQUIRED'));
  }

  try {
    const userId = req.user.id;
    const bills = await prisma.bill.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    console.log('📄 [Billing] Fetched bills for user', {
      userId,
      billCount: bills.length,
    });
    res.json(bills);
  } catch (error) {
    next(error);
  }
});

module.exports = router;