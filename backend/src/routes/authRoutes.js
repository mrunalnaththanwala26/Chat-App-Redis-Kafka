const express = require('express');
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/register', (_req, res) => {
  res.status(405).set('Allow', 'POST').json({
    error: 'Method Not Allowed',
    message: 'Use POST with JSON body: { "name", "email", "password" } (min 8 chars).',
  });
});

router.get('/login', (_req, res) => {
  res.status(405).set('Allow', 'POST').json({
    error: 'Method Not Allowed',
    message: 'Use POST with JSON body: { "email", "password" }.',
  });
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too Many Requests', message: 'Too many reset attempts. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post(
  '/register',
  [
    body('name').trim().notEmpty().isLength({ max: 120 }),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8, max: 128 }),
  ],
  authController.register
);

router.post(
  '/login',
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  authController.login
);

router.get('/me', requireAuth, authController.me);

router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  [body('email').isEmail().normalizeEmail()],
  authController.forgotPassword
);

router.post(
  '/verify-reset-code',
  forgotPasswordLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('code').isLength({ min: 6, max: 6 }).isNumeric(),
  ],
  authController.verifyResetCode
);

router.post(
  '/reset-password',
  [
    body('resetToken').notEmpty(),
    body('newPassword').isLength({ min: 8, max: 128 }),
  ],
  authController.resetPassword
);

module.exports = router;
