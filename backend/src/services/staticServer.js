import express from 'express';
import { findAvailablePort } from '../utils/portFinder.js';
import logger from '../utils/logger.js';

export async function startStaticServer(rootDir) {
  const port = await findAvailablePort();
  const app = express();

  app.use(express.static(rootDir));

  return new Promise((resolve, reject) => {
    const server = app.listen(port, '127.0.0.1', () => {
      const url = `http://127.0.0.1:${port}`;
      logger.debug({ url, rootDir }, 'Static server started');

      resolve({
        url,
        port,
        close: () =>
          new Promise((res, rej) => {
            server.close((err) => {
              if (err) {
                logger.warn({ err }, 'Error closing static server');
                rej(err);
              } else {
                logger.debug({ port }, 'Static server stopped');
                res();
              }
            });
          }),
      });
    });

    server.on('error', (err) => {
      logger.error({ err, port }, 'Static server failed to start');
      reject(err);
    });
  });
}
