const amqp = require('amqplib');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';

const startConsumer = async () => {
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();
    
    const queue = 'booking_events';
    await channel.assertQueue(queue, { durable: true });
    
    console.log(`🎧 Billing Service is listening for messages in '${queue}'...`);

    channel.consume(queue, async (msg) => {
      if (msg !== null) {
        const payload = JSON.parse(msg.content.toString());
        
        if (payload.event === 'ReservationCreated') {
          const reservation = payload.data;
          console.log(`🧾 Received reservation: ${reservation.id}. Calculating bill...`);

          // Calculate total: $10 base fee + sum of menu items
          let totalAmount = 10.00; 
          if (reservation.menuItems && reservation.menuItems.length > 0) {
             const menuTotal = reservation.menuItems.reduce((sum, item) => sum + item.price, 0);
             totalAmount += menuTotal;
          }

          // Save the bill to Postgres
          await prisma.bill.create({
            data: {
              reservationId: reservation.id,
              userId: reservation.userId,
              totalAmount: totalAmount
            }
          });

          console.log(`✅ Bill created for reservation ${reservation.id}. Total: $${totalAmount}`);
        }

        // Acknowledge the message so RabbitMQ removes it from the queue
        channel.ack(msg);
      }
    });
  } catch (error) {
    console.error('❌ Billing Consumer Error:', error);
  }
};

module.exports = { startConsumer };