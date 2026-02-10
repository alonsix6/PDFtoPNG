import multer from 'multer';
import config from '../config.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.maxFileSizeMb * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase();
    if (
      file.mimetype === 'application/zip' ||
      file.mimetype === 'application/x-zip-compressed' ||
      file.mimetype === 'application/octet-stream' ||
      name.endsWith('.zip') ||
      file.mimetype === 'text/html' ||
      name.endsWith('.html') ||
      name.endsWith('.htm')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only ZIP or HTML files are allowed'));
    }
  },
});

export default upload;
