const express = require('express');
const cors = require('cors');
require('dotenv').config();

const bookingRoutes = require('./routes/bookingRoutes');
const { connectRabbitMQ } = require('./config/rabbitmq'); 

const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json());

// Initialize RabbitMQ when the server starts
connectRabbitMQ(); 

app.use('/api/bookings', bookingRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'Booking Service is running', db: 'PostgreSQL' });
});

app.listen(PORT, () => {
  console.log(`📅 Booking Service running on http://localhost:${PORT}`);
});