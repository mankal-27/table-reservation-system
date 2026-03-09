const express = require('express');
const passport = require('passport');
const router = express.Router();

/**
 * @swagger
 * /auth/google:
 *   get:
 *     summary: Trigger Google OAuth login
 *     responses:
 *       302:
 *         description: Redirect to Google login page
 */
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

/**
 * @swagger
 * /auth/google/callback:
 *   get:
 *     summary: Google callback URL after successful login
 *     responses:
 *       200:
 *         description: Successfully logged in
 *       302:
 *         description: Redirect on failure
 */
router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login-failed' }),
  (req, res) => {
    res.json({ message: '✅ Successfully logged in with OAuth2!', user: req.user });
  }
);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get current logged-in user
 *     responses:
 *       200:
 *         description: Current user data
 *       401:
 *         description: Not authenticated
 */
router.get('/me', (req, res) => {
  if (req.isAuthenticated()) {
    res.json(req.user);
  } else {
    res.status(401).json({ message: 'Not authenticated' });
  }
});

/**
 * @swagger
 * /auth/logout:
 *   get:
 *     summary: Logout
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
router.get('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) { return next(err); }
    res.json({ message: 'Logged out successfully' });
  });
});

module.exports = router;