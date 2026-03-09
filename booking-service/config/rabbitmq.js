const amqp = require('amqplib');
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';

let channel = null;

const connectRabbitMQ = async () => {
  let retries = 5;
  
  while (retries > 0) {
    try {
      const connection = await amqp.connect(RABBITMQ_URL);
      channel = await connection.createChannel();
      await channel.assertQueue('booking_events', { durable: true });
      
      console.log('🐇 Connected to RabbitMQ & Queue Ready');
      break; // Success! Exit the loop.
      
    } catch (error) {
      console.log(`⏳ RabbitMQ not ready yet. Retrying in 5 seconds... (${retries} attempts left)`);
      retries -= 1;
      // Wait for 5 seconds before the loop runs again
      await new Promise(res => setTimeout(res, 5000)); 
    }
  }
};

const getChannel = () => channel;
module.exports = { connectRabbitMQ, getChannel };