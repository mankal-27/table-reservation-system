const amqp = require('amqplib');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';

const startConsumer = async () => {
  let retries = 10;
  while (retries > 0) {
    try {
      const connection = await amqp.connect(RABBITMQ_URL);
      const channel = await connection.createChannel();

      const queue = 'booking_events';
      await channel.assertQueue(queue, { durable: true });

      console.log(`🎧 Billing Service is listening for messages in '${queue}'...`);

      channel.consume(queue, async (msg) => {
        if (msg !== null) {
          try {
            const payload = JSON.parse(msg.content.toString());

            if (payload.event === 'ReservationCreated') {
              const reservation = payload.data;
              console.log(`🧾 [Billing] Received reservation: ${reservation.id}. Calculating bill...`);

              // Idempotency guard: do not create duplicate bills for the same reservation
              const existingBill = await prisma.bill.findUnique({
                where: { reservationId: reservation.id },
              });

              if (existingBill) {
                console.log('⚠️ [Billing] Bill already exists for reservation, skipping create', {
                  reservationId: reservation.id,
                  billId: existingBill.id,
                });
              } else {
                // Calculate total: $10 base fee + sum of menu items
                let totalAmount = 10.00;
                if (reservation.menuItems && reservation.menuItems.length > 0) {
                  const menuTotal = reservation.menuItems.reduce((sum, item) => sum + item.price, 0);
                  totalAmount += menuTotal;
                }

                // Save the bill to Postgres
                const createdBill = await prisma.bill.create({
                  data: {
                    reservationId: reservation.id,
                    userId: reservation.userId,
                    totalAmount: totalAmount
                  }
                });

                console.log(`✅ [Billing] Bill created for reservation ${reservation.id}. Total: $${totalAmount}`, {
                  billId: createdBill.id,
                });
              }
            }
          } catch (err) {
            console.error('💥 [Billing Consumer] Failed to process message', {
              error: err.message,
              stack: err.stack,
              rawMessage: msg.content.toString(),
            });
          } finally {
            // Acknowledge the message so RabbitMQ removes it from the queue
            channel.ack(msg);
          }
        }
      });
      return; // Success! Exit the loop.
    } catch (error) {
      console.log(`⏳ RabbitMQ not ready yet. Retrying in 5 seconds... (${retries} attempts left)`);
      retries -= 1;
      await new Promise(res => setTimeout(res, 5000));
    }
  }
  console.error('❌ Failed to connect to RabbitMQ after multiple attempts.');
};

module.exports = { startConsumer };