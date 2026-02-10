import { Router } from 'express';
import path from 'path';
import os from 'os';
import fs from 'fs';
import archiver from 'archiver';
import upload from '../middleware/upload.js';
import { jobManager } from '../services/jobManager.js';
import { extractZip } from '../services/zipExtractor.js';
import { detectSlides } from '../services/slideDetector.js';
import { startStaticServer } from '../services/staticServer.js';
import { captureSlides } from '../renderer/captureSlides.js';
import { ensureDir } from '../utils/cleanup.js';
import config from '../config.js';
import logger from '../utils/logger.js';

const router = Router();

// POST /api/render
router.post('/render', upload.single('zipFile'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No ZIP file provided' });
    }

    if (!jobManager.canAcceptJob()) {
      return res.status(503).json({
        error: 'Server busy. Please try again shortly.',
        retryAfterSeconds: 30,
      });
    }

    const jobId = jobManager.createJob();

    // Fire and forget — process asynchronously
    // Note: decrementActive is handled in processJob's finally block
    processJob(jobId, req.file.buffer).catch((err) => {
      logger.error({ err, jobId }, 'Job processing failed');
    });

    res.status(202).json({ jobId, status: 'pending' });
  } catch (err) {
    logger.error({ err }, 'Error creating render job');
    res.status(500).json({ error: 'Failed to create render job' });
  }
});

// GET /api/jobs/:id
router.get('/jobs/:id', (req, res) => {
  const job = jobManager.getJob(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.json({
    jobId: job.id,
    status: job.status,
    phase: job.phase,
    progress: { current: job.progress, total: job.total },
    error: job.error,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
  });
});

// GET /api/jobs/:id/download
router.get('/jobs/:id/download', (req, res) => {
  const job = jobManager.getJob(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  if (job.status !== 'completed') {
    return res.status(400).json({ error: 'Job is not ready for download' });
  }

  if (!job.outputPath || !fs.existsSync(job.outputPath)) {
    return res.status(410).json({ error: 'Output file no longer available' });
  }

  const timestamp = Date.now();
  const filename = `slideforge-${timestamp}.zip`;

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const stream = fs.createReadStream(job.outputPath);
  stream.on('error', (err) => {
    logger.error({ err, jobId: job.id }, 'Error streaming download');
    if (!res.headersSent) {
      res.status(500).json({ error: 'Download failed' });
    }
  });
  stream.pipe(res);
});

async function processJob(jobId, zipBuffer) {
  jobManager.incrementActive();
  jobManager.updateStatus(jobId, 'processing');

  const baseDir = path.join(os.tmpdir(), 'slideforge', jobId);
  const extractDir = path.join(baseDir, 'input');
  const outputDir = path.join(baseDir, 'output');
  const outputZipPath = path.join(baseDir, 'slides.zip');

  jobManager.setTempDir(jobId, baseDir);

  let staticServer = null;
  let timeout = null;
  const abortController = new AbortController();

  try {
    // Set job timeout — aborts rendering and marks job as failed
    timeout = setTimeout(() => {
      abortController.abort();
      jobManager.failJob(jobId, 'Job timed out');
    }, config.jobTimeoutMs);

    // Extract ZIP
    jobManager.updatePhase(jobId, 'extracting');
    await ensureDir(extractDir);
    await ensureDir(outputDir);

    const { rootDir } = await extractZip(zipBuffer, extractDir);
    // Release buffer from memory
    zipBuffer = null;

    // Detect slide mode
    jobManager.updatePhase(jobId, 'detecting');
    const slideInfo = await detectSlides(rootDir);

    // Start static server
    staticServer = await startStaticServer(rootDir);

    // Capture slides
    jobManager.updatePhase(jobId, 'rendering');
    await captureSlides({
      mode: slideInfo.mode,
      htmlFiles: slideInfo.htmlFiles,
      entryFile: slideInfo.entryFile,
      staticServerUrl: staticServer.url,
      outputDir,
      signal: abortController.signal,
      onProgress: (current, total) => {
        jobManager.updateProgress(jobId, current, total);
      },
    });

    // Package output PNGs into ZIP
    jobManager.updatePhase(jobId, 'packaging');
    await createOutputZip(outputDir, outputZipPath);

    jobManager.completeJob(jobId, outputZipPath);
  } catch (err) {
    const job = jobManager.getJob(jobId);
    if (job && job.status !== 'failed') {
      jobManager.failJob(jobId, err.message);
    }
    throw err;
  } finally {
    if (timeout) clearTimeout(timeout);
    if (staticServer) {
      try {
        await staticServer.close();
      } catch {
        // ignore close errors
      }
    }
    jobManager.decrementActive();
  }
}

function createOutputZip(sourceDir, outputPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 6 } });

    output.on('close', resolve);
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

export default router;
