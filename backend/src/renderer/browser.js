import { chromium } from 'playwright';
import logger from '../utils/logger.js';

let browser = null;

export async function getBrowser() {
  if (!browser || !browser.isConnected()) {
    logger.info('Launching Chromium browser');
    browser = await chromium.launch({
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-zygote',
        '--single-process',
      ],
    });

    browser.on('disconnected', () => {
      logger.warn('Browser disconnected unexpectedly');
      browser = null;
    });
  }

  return browser;
}

export async function closeBrowser() {
  if (browser) {
    try {
      await browser.close();
    } catch (err) {
      logger.warn({ err }, 'Error closing browser');
    }
    browser = null;
  }
}
