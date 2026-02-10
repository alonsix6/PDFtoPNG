import config from '../config.js';
import logger from '../utils/logger.js';

export default function errorHandler(err, _req, res, _next) {
  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: `File too large. Maximum size is ${config.maxFileSizeMb}MB.`,
    });
  }

  // Multer file filter error
  if (err.message === 'Only ZIP files are allowed') {
    return res.status(400).json({ error: err.message });
  }

  // Multer unexpected field
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ error: 'Unexpected file field' });
  }

  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
}
