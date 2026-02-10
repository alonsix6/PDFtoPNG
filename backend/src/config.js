const config = Object.freeze({
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  allowedOrigins: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
    : ['http://localhost:5173'],
  maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10),
  jobTtlMs: parseInt(process.env.JOB_TTL_MINUTES || '30', 10) * 60 * 1000,
  maxConcurrentJobs: parseInt(process.env.MAX_CONCURRENT_JOBS || '3', 10),
  jobTimeoutMs: parseInt(process.env.JOB_TIMEOUT_MINUTES || '5', 10) * 60 * 1000,
  logLevel: process.env.LOG_LEVEL || 'info',
});

export default config;
