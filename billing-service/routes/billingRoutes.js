const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const amqp = require('amqplib');

const prisma = new PrismaClient();
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';

// GET /api/billing/:reservationId - View the bill
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

// POST /api/billing/:id/pay - Pay the bill
router.post('/:id/pay', async (req, res) => {
  try {
    const billId = req.params.id;
    
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
      data: updatedBill
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

module.exports = router;