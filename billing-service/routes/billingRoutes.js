const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const amqp = require('amqplib');

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
router.get('/:reservationId', async (req, res) => {
  try {
    const bill = await prisma.bill.findUnique({
      where: { reservationId: req.params.reservationId }
    });

    if (!bill) return res.status(404).json({ error: 'Bill not found' });
    res.json(bill);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch bill' });
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
router.post('/:id/pay', async (req, res) => {
  try {
    const billId = req.params.id;

    // SECURITY FIX: Check authentication and ownership
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: '❌ You must be logged in to pay a bill.' });
    }

    const bill = await prisma.bill.findUnique({ where: { id: billId } });
    if (!bill) return res.status(404).json({ error: 'Bill not found' });

    if (bill.userId !== req.user.id) {
      return res.status(403).json({ error: '❌ You are not authorized to pay this bill.' });
    }

    // 1. Update the database
    const updatedBill = await prisma.bill.update({
      where: { id: billId },
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

    res.json({ message: '💸 Bill paid successfully!', bill: updatedBill });
  } catch (error) {
    res.status(500).json({ error: 'Payment failed' });
  }
});

/**
 * @swagger
 * /api/billing/user/{userId}:
 *   get:
 *     summary: Get all bills for a specific user
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of bills
 *       500:
 *         description: Failed to fetch bills
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const bills = await prisma.bill.findMany({
      where: { userId: req.params.userId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(bills);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch bills' });
  }
});

module.exports = router;