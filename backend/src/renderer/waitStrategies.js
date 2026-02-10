import logger from '../utils/logger.js';

export async function waitForSlideReady(page) {
  // 1. Wait for all resources (stylesheets, images) to load
  await page.waitForLoadState('load');

  // 2. Wait for network to become idle (with timeout — some slides have persistent connections)
  try {
    await page.waitForLoadState('networkidle', { timeout: 10_000 });
  } catch {
    logger.debug('networkidle timeout — continuing with capture');
  }

  // 3. Wait for all fonts to finish loading
  try {
    await page.waitForFunction(() => document.fonts.ready.then(() => true), {
      timeout: 5_000,
    });
  } catch {
    logger.debug('Font loading timeout — continuing with capture');
  }

  // 4. Check for optional data-ready attribute
  try {
    await page.waitForSelector('[data-ready]', { timeout: 1_000 });
  } catch {
    // data-ready not present — that's fine
  }

  // 5. Small settle delay for CSS animations/transitions
  await page.waitForTimeout(200);
}
