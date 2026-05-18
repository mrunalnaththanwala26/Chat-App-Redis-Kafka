const path = require('path');
const fs = require('fs');
const multer = require('multer');
const env = require('./env');
const { v4: uuidv4 } = require('uuid');
const mime = require('mime-types');

const allowedPrefix = [
  'image/',
  'video/',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument',
  'text/plain',
];

function isAllowedMime(m) {
  if (!m) return false;
  return allowedPrefix.some((p) => m.startsWith(p));
}

function ensureUserDir(userId) {
  const dir = path.join(env.uploadDir, String(userId));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function makeStorage(userIdResolver) {
  return multer.diskStorage({
    destination: (req, _file, cb) => {
      const uid = userIdResolver(req);
      const dir = ensureUserDir(uid);
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || `.${mime.extension(file.mimetype) || 'bin'}`;
      cb(null, `${Date.now()}-${uuidv4()}${ext}`);
    },
  });
}

function fileFilter(_req, file, cb) {
  if (isAllowedMime(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed: ${file.mimetype}`));
  }
}

function buildUpload(userIdResolver) {
  return multer({
    storage: makeStorage(userIdResolver),
    fileFilter,
    limits: { fileSize: env.maxFileSizeBytes, files: 50 },
  });
}

function validateTotalSize(req, res, next) {
  const total = (req.files || []).reduce((s, f) => s + f.size, 0);
  if (total > env.maxFileSizeBytes) {
    return res.status(400).json({ error: 'Total upload size exceeds limit (1GB)' });
  }
  next();
}

module.exports = { buildUpload, validateTotalSize, isAllowedMime };
