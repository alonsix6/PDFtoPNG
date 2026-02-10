import { nanoid } from 'nanoid';
import config from '../config.js';
import logger from '../utils/logger.js';
import { cleanupDir } from '../utils/cleanup.js';

const jobs = new Map();
let activeCount = 0;
let cleanupInterval = null;

export const jobManager = {
  createJob(resolution) {
    const id = nanoid(12);
    const job = {
      id,
      status: 'pending',
      phase: null,
      progress: 0,
      total: 0,
      resolution,
      error: null,
      createdAt: new Date().toISOString(),
      completedAt: null,
      outputPath: null,
      tempDir: null,
    };
    jobs.set(id, job);
    logger.info({ jobId: id, resolution }, 'Job created');
    return id;
  },

  getJob(jobId) {
    return jobs.get(jobId) || null;
  },

  updateStatus(jobId, status) {
    const job = jobs.get(jobId);
    if (job) {
      job.status = status;
    }
  },

  updatePhase(jobId, phase) {
    const job = jobs.get(jobId);
    if (job) {
      job.phase = phase;
      logger.info({ jobId, phase }, 'Job phase updated');
    }
  },

  updateProgress(jobId, current, total) {
    const job = jobs.get(jobId);
    if (job) {
      job.progress = current;
      job.total = total;
    }
  },

  setTempDir(jobId, tempDir) {
    const job = jobs.get(jobId);
    if (job) {
      job.tempDir = tempDir;
    }
  },

  completeJob(jobId, outputPath) {
    const job = jobs.get(jobId);
    if (job) {
      job.status = 'completed';
      job.outputPath = outputPath;
      job.completedAt = new Date().toISOString();
      logger.info({ jobId }, 'Job completed');
    }
  },

  failJob(jobId, errorMessage) {
    const job = jobs.get(jobId);
    if (job) {
      job.status = 'failed';
      job.error = errorMessage;
      job.completedAt = new Date().toISOString();
      logger.error({ jobId, error: errorMessage }, 'Job failed');
    }
  },

  canAcceptJob() {
    return activeCount < config.maxConcurrentJobs;
  },

  incrementActive() {
    activeCount++;
    logger.debug({ activeCount }, 'Active job count incremented');
  },

  decrementActive() {
    activeCount = Math.max(0, activeCount - 1);
    logger.debug({ activeCount }, 'Active job count decremented');
  },

  startCleanupScheduler() {
    if (cleanupInterval) return;

    cleanupInterval = setInterval(async () => {
      const now = Date.now();
      for (const [id, job] of jobs) {
        if (!job.completedAt) continue;
        const completedTime = new Date(job.completedAt).getTime();
        if (now - completedTime > config.jobTtlMs) {
          logger.info({ jobId: id }, 'Cleaning up expired job');
          if (job.tempDir) {
            await cleanupDir(job.tempDir);
          }
          jobs.delete(id);
        }
      }
    }, 60_000);

    // Allow process to exit even if interval is running
    cleanupInterval.unref();
    logger.info('Job cleanup scheduler started');
  },

  stopCleanupScheduler() {
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
      cleanupInterval = null;
    }
  },
};
