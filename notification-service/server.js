const amqp = require('amqplib');
const nodemailer = require('nodemailer');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';

const startNotificationService = async () => {
  try {
    // 1. Generate an automatic test email account
    const testAccount = await nodemailer.createTestAccount();
    const transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });

    // 2. Connect to RabbitMQ with Retries
    let retries = 10;
    while (retries > 0) {
      try {
        const connection = await amqp.connect(RABBITMQ_URL);
        const channel = await connection.createChannel();

        const queue = 'notification_events';
        await channel.assertQueue(queue, { durable: true });

        console.log(`📧 Notification Service listening for messages in '${queue}'...`);

        // 3. Consume messages
        channel.consume(queue, async (msg) => {
          if (msg !== null) {
            const payload = JSON.parse(msg.content.toString());

            if (payload.event === 'BillPaid') {
              const bill = payload.data;
              console.log(`\n🔔 Received 'BillPaid' event for Bill: ${bill.id}`);

              // 4. Send the Email!
              const info = await transporter.sendMail({
                from: '"Table Reservation System" <no-reply@tables.com>',
                to: bill.userEmail || "user@example.com",
                subject: "Your Reservation Receipt 🧾",
                text: `Thank you for your payment of $${bill.totalAmount}! Your reservation is confirmed.`,
                html: `<h3>Thank you!</h3><p>Your payment of <b>$${bill.totalAmount}</b> was successful.</p><p>Reservation ID: ${bill.reservationId}</p>`
              });

              console.log(`✅ Email sent successfully!`);
              console.log(`🔗 Preview your email here: ${nodemailer.getTestMessageUrl(info)}\n`);
            }

            channel.ack(msg);
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
  } catch (error) {
    console.error('❌ Notification Service Error:', error);
  }
};

startNotificationService();