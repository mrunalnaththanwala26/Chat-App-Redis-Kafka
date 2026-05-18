const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const env = require('../config/env');
const { sendPasswordResetEmail } = require('../services/mailService');
const { logger } = require('../utils/logger');

function signToken(userId, email) {
  return jwt.sign({ sub: userId.toString(), email }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

async function register(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { name, email, password } = req.body;
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ error: 'Conflict', message: 'Email already registered' });
  }
  const hashed = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email: email.toLowerCase(), password: hashed });
  const token = signToken(user._id, user.email);
  res.status(201).json({
    token,
    user: { id: user._id.toString(), name: user.name, email: user.email },
  });
}

async function login(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { email, password } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid credentials' });
  }
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid credentials' });
  }
  const token = signToken(user._id, user.email);
  res.json({
    token,
    user: { id: user._id.toString(), name: user.name, email: user.email },
  });
}

async function me(req, res) {
  res.json({
    user: {
      id: req.user._id.toString(),
      name: req.user.name,
      email: req.user.email,
    },
  });
}

async function forgotPassword(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { email } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() });
  const generic = { message: 'If an account exists for this email, a reset code has been sent.' };
  if (!user) {
    return res.json(generic);
  }
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const resetCodeHash = await bcrypt.hash(code, 10);
  user.resetCodeHash = resetCodeHash;
  user.resetCodeExpires = new Date(Date.now() + 15 * 60 * 1000);
  await user.save();
  try {
    await sendPasswordResetEmail(user.email, code);
  } catch (err) {
    logger.error('sendPasswordResetEmail failed', err);
    return res.status(502).json({ error: 'Bad Gateway', message: 'Could not send email' });
  }
  res.json(generic);
}

async function verifyResetCode(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { email, code } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() }).select('+resetCodeHash');
  if (!user || !user.resetCodeHash || !user.resetCodeExpires || user.resetCodeExpires < new Date()) {
    return res.status(400).json({ error: 'Bad Request', message: 'Invalid or expired code' });
  }
  const valid = await bcrypt.compare(String(code), user.resetCodeHash);
  if (!valid) {
    return res.status(400).json({ error: 'Bad Request', message: 'Invalid or expired code' });
  }
  const resetToken = jwt.sign(
    { purpose: 'password_reset', sub: user._id.toString() },
    env.jwtSecret,
    { expiresIn: '15m' }
  );
  res.json({ resetToken, message: 'Code verified' });
}

async function resetPassword(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { resetToken, newPassword } = req.body;
  let payload;
  try {
    payload = jwt.verify(resetToken, env.jwtSecret);
  } catch {
    return res.status(400).json({ error: 'Bad Request', message: 'Invalid reset token' });
  }
  if (payload.purpose !== 'password_reset' || !payload.sub) {
    return res.status(400).json({ error: 'Bad Request', message: 'Invalid reset token' });
  }
  const user = await User.findById(payload.sub).select('+password +resetCodeHash');
  if (!user) {
    return res.status(400).json({ error: 'Bad Request', message: 'User not found' });
  }
  user.password = await bcrypt.hash(newPassword, 12);
  user.resetCodeHash = undefined;
  user.resetCodeExpires = undefined;
  await user.save();
  res.json({ message: 'Password updated' });
}

module.exports = {
  register,
  login,
  me,
  forgotPassword,
  verifyResetCode,
  resetPassword,
};
