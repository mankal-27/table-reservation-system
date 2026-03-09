const express = require('express');
const cors = require('cors');
require('dotenv').config();

const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const passport = require('passport');
const bookingRoutes = require('./routes/bookingRoutes');
const { connectRabbitMQ } = require('./config/rabbitmq');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'Booking Service API',
      version: '1.0.0',
      description: 'API for managing restaurant table reservations',
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3003}`,
      },
    ],
  },
  apis: ['./routes/*.js'],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);

const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors({
  origin: (origin, callback) => callback(null, true),
  credentials: true
}));
app.use(express.json());

// Session & Passport (Shared with User Service)
const USER_DB_URL = process.env.DATABASE_URL.replace('booking_db', 'user_db'); // Point to the central user db
app.use(session({
  store: new pgSession({
    conString: USER_DB_URL,
    tableName: 'session'
  }),
  name: 'session_id', // Force a specific cookie name across all services
  secret: process.env.SESSION_SECRET || 'fallback_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    secure: false,
    domain: 'localhost'
  }
}));
app.use(passport.initialize());
app.use(passport.session());

// Simple deserializer for shared sessions: Just attach the ID to req.user
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((id, done) => {
  done(null, { id }); // Attach the ID we got from the session DB
});

// Initialize RabbitMQ when the server starts
connectRabbitMQ();

app.use('/api/bookings', bookingRoutes);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

app.get('/health', (req, res) => {
  res.json({ status: 'Booking Service is running', db: 'PostgreSQL' });
});

app.listen(PORT, () => {
  console.log(`📅 Booking Service running on http://localhost:${PORT}`);
});