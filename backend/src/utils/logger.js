import pino from 'pino';
import config from '../config.js';

const transport =
  config.nodeEnv === 'development'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined;

const logger = pino({
  name: 'slideforge',
  level: config.logLevel,
  transport,
});

export default logger;
