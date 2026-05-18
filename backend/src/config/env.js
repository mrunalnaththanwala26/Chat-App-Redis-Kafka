const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const maxFile = Number(process.env.MAX_FILE_SIZE_BYTES) || 1073741824;

module.exports = {
  port: Number(process.env.PORT) || 3000,
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/chat_app',
  jwtSecret: process.env.JWT_SECRET || 'change-me-in-production-use-long-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  kafkaBrokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(',').map((s) => s.trim()),
  kafkaTopicMessageSent: process.env.KAFKA_TOPIC_MESSAGE_SENT || 'message_sent',
  /** When false, messages are processed inline (no broker). Set SKIP_KAFKA=true for local dev without Kafka. */
  kafkaEnabled:
    process.env.SKIP_KAFKA !== 'true' && String(process.env.KAFKA_ENABLED).toLowerCase() !== 'false',
  nodeEnv: process.env.NODE_ENV || 'development',
  maxFileSizeBytes: maxFile,
  uploadDir: process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads'),
  publicBaseUrl: process.env.PUBLIC_BASE_URL || `http://localhost:${Number(process.env.PORT) || 3000}`,
  smtp: {
    host: process.env.SMTP_HOST || 'localhost',
    port: Number(process.env.SMTP_PORT) || 1025,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
  emailFrom: process.env.EMAIL_FROM || 'noreply@chatapp.local',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
};
