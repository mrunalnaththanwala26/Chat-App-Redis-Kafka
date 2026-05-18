const jwt = require('jsonwebtoken');
const env = require('../config/env');

function requireUserHttp(req, res, next) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(header.slice(7), env.jwtSecret);
      req.userId = payload.sub;
      req.userEmail = payload.email;
      return next();
    } catch {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid token' });
    }
  }
  return res.status(401).json({ error: 'Unauthorized', message: 'Missing bearer token' });
}

module.exports = { requireUserHttp };
