const express = require('express');
const passport = require('passport');
const router = express.Router();

// Trigger Google OAuth login
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Google callback URL after successful login
router.get('/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login-failed' }),
  (req, res) => {
    // In a real app, redirect to frontend. For MVP, just send success JSON.
    res.json({ message: '✅ Successfully logged in with OAuth2!', user: req.user });
  }
);

// Get current logged-in user
router.get('/me', (req, res) => {
  if (req.isAuthenticated()) {
    res.json(req.user);
  } else {
    res.status(401).json({ message: 'Not authenticated' });
  }
});

// Logout
router.get('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) { return next(err); }
    res.json({ message: 'Logged out successfully' });
  });
});

module.exports = router;