import cors from 'cors';
import config from '../config.js';

const corsMiddleware = cors({
  origin:
    config.nodeEnv === 'production'
      ? config.allowedOrigins
      : true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
});

export default corsMiddleware;
