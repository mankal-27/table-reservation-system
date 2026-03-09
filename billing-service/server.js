const express = require('express');
const cors = require('cors');
require('dotenv').config();

const billingRoutes = require('./routes/billingRoutes');
const { startConsumer } = require('./rabbitmq/consumer');

const app = express();
const PORT = process.env.PORT || 3004;

app.use(cors());
app.use(express.json());

// Start listening to RabbitMQ in the background
startConsumer();

app.use('/api/billing', billingRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'Billing Service is running', db: 'PostgreSQL' });
});

app.listen(PORT, () => {
  console.log(`💳 Billing Service running on http://localhost:${PORT}`);
});