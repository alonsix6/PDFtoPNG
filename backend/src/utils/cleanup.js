import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import logger from './logger.js';

const tmpRoot = path.resolve(os.tmpdir());

export async function cleanupDir(dirPath) {
  const resolved = path.resolve(dirPath);
  if (!resolved.startsWith(tmpRoot)) {
    logger.error({ dirPath: resolved }, 'Refusing to delete path outside tmpdir');
    return;
  }
  try {
    await fs.rm(resolved, { recursive: true, force: true });
    logger.debug({ dirPath: resolved }, 'Cleaned up directory');
  } catch (err) {
    logger.warn({ err, dirPath: resolved }, 'Failed to clean up directory');
  }
}

export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}
