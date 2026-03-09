const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const passport = require('passport');
const cors = require('cors');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
require('dotenv').config();
const { errorHandler } = require('./utils/errors');

const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'User Service API',
      version: '1.0.0',
      description: 'API for user authentication and profile management',
    },
    servers: [
      {
        url: '/',
        description: 'Current Host'
      },
      {
        url: `http://localhost:${process.env.PORT || 3002}`,
        description: 'Localhost'
      }
    ],
  },
  apis: ['./routes/*.js'],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);

// Initialize Passport config
require('./config/passport');
const authRoutes = require('./routes/authRoutes');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors({
  origin: (origin, callback) => callback(null, true),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Request Logger Middleware
app.use((req, res, next) => {
  console.log(`📡 [${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use(express.json());

// Session middleware (Persistent with PostgreSQL)
const sessionStore = new pgSession({
  conString: process.env.DATABASE_URL,
  tableName: 'session'
});

sessionStore.on('error', (error) => {
  console.error('❌ Session Store Error:', error);
});

app.use(session({
  store: sessionStore,
  name: 'session_id', // Force a specific cookie name across all services
  secret: process.env.SESSION_SECRET || 'fallback_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    secure: false, // Set to true in production with HTTPS
    domain: 'localhost' // Allow cookie to be sent across different ports on localhost
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/auth', authRoutes);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'User Service is running', db: 'PostgreSQL' });
});

// Global error handler (must be after routes)
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`👤 User Service running on http://localhost:${PORT}`);
});