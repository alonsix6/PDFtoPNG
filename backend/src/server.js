import express from 'express';
import config from './config.js';
import logger from './utils/logger.js';
import corsMiddleware from './middleware/cors.js';
import errorHandler from './middleware/errorHandler.js';
import jobsRouter from './routes/jobs.js';
import { closeBrowser } from './renderer/browser.js';
import { jobManager } from './services/jobManager.js';

const app = express();

app.use(corsMiddleware);
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Job routes
app.use('/api', jobsRouter);

// Global error handler
app.use(errorHandler);

const server = app.listen(config.port, () => {
  logger.info(
    { port: config.port, env: config.nodeEnv },
    'SlideForge server started'
  );
  jobManager.startCleanupScheduler();
});

// Graceful shutdown
async function shutdown(signal) {
  logger.info({ signal }, 'Shutting down gracefully');

  server.close(() => {
    logger.info('HTTP server closed');
  });

  jobManager.stopCleanupScheduler();

  try {
    await closeBrowser();
  } catch (err) {
    logger.error({ err }, 'Error during browser shutdown');
  }

  // Give active connections time to close
  setTimeout(() => {
    logger.info('Forcing exit');
    process.exit(0);
  }, 30_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
