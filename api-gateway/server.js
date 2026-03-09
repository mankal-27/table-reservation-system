const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors({
    origin: (origin, callback) => callback(null, true),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Route Definitions
const routes = {
    '/auth': process.env.USER_SERVICE_URL || 'http://localhost:3002',
    '/api/users': process.env.USER_SERVICE_URL || 'http://localhost:3002',
    '/api/restaurants': process.env.CATALOG_SERVICE_URL || 'http://localhost:3001',
    '/api/bookings': process.env.BOOKING_SERVICE_URL || 'http://localhost:3003',
    '/api/billing': process.env.BILLING_SERVICE_URL || 'http://localhost:3004'
};

for (const [route, target] of Object.entries(routes)) {
    app.use(route, createProxyMiddleware({
        target,
        changeOrigin: true,
        xfwd: true,
        logLevel: 'debug',
        pathRewrite: (path, req) => req.originalUrl
    }));
}

// Health check endpoint for the gateway itself
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'API Gateway is running' });
});

app.listen(PORT, () => {
    console.log(`🚀 API Gateway running on http://localhost:${PORT}`);
});
