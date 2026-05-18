const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');

const env = require('./config/env');
const authRoutes = require('./routes/authRoutes');
const chatRoutes = require('./routes/chatRoutes');
const swaggerSpec = require('./config/swagger');
const { logger } = require('./utils/logger');

function createApp() {
  const app = express();

  fs.mkdirSync(env.uploadDir, { recursive: true });

  app.set('trust proxy', 1);
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );
  app.use(compression());
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN?.split(',') || true,
      credentials: true,
    })
  );
  app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: env.nodeEnv === 'production' ? 300 : 1000,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(globalLimiter);

  app.use(express.json({ limit: '2mb' }));

  app.use('/files', express.static(env.uploadDir));

  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get('/openapi.json', (_req, res) => res.json(swaggerSpec));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'backend' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/chat', chatRoutes);

  app.use((err, _req, res, _next) => {
    logger.error(err.stack || err.message);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large' });
    }
    const status = err.status || err.statusCode || 500;
    res.status(status).json({ error: err.message || 'Internal Server Error' });
  });

  return app;
}

module.exports = { createApp };
