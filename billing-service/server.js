const express = require('express');
const cors = require('cors');
require('dotenv').config();

const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const passport = require('passport');
const billingRoutes = require('./routes/billingRoutes');
const { startConsumer } = require('./rabbitmq/consumer');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const { errorHandler } = require('./utils/errors');

const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'Billing Service API',
      version: '1.0.0',
      description: 'API for managing bills and payments',
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3004}`,
      },
    ],
  },
  apis: ['./routes/*.js'],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);

const app = express();
const PORT = process.env.PORT || 3004;

app.use(cors({
  origin: (origin, callback) => callback(null, true),
  credentials: true
}));
app.use(express.json());

// Session & Passport (Shared with User Service)
const USER_DB_URL = process.env.DATABASE_URL.replace('billing_db', 'user_db'); // Point to the central user db
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

// Start listening to RabbitMQ in the background
startConsumer();

app.use('/api/billing', billingRoutes);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

app.get('/health', (req, res) => {
  res.json({ status: 'Billing Service is running', db: 'PostgreSQL' });
});

// Global error handler (must be after routes)
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`💳 Billing Service running on http://localhost:${PORT}`);
});