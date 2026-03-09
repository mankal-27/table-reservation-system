const amqp = require('amqplib');

let channel = null;

const connectRabbitMQ = async () => {
  try {
    // Connect to the RabbitMQ Docker container running on localhost:5672
    const connection = await amqp.connect('amqp://localhost:5672');
    channel = await connection.createChannel();
    
    // Ensure the queue exists before we try to send messages to it
    await channel.assertQueue('booking_events', { durable: true });
    
    console.log('🐇 Connected to RabbitMQ & Queue Ready');
  } catch (error) {
    console.error('❌ RabbitMQ Connection Failed:', error);
  }
};

const getChannel = () => channel;

module.exports = { connectRabbitMQ, getChannel };