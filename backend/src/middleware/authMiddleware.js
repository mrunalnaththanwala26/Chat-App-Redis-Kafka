const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');

async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Missing bearer token' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    const userId = payload.sub;
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'User not found' });
    }
    req.user = user;
    req.userId = user._id.toString();
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
}

module.exports = { requireAuth };
