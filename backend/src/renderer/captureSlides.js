import path from 'path';
import { getBrowser } from './browser.js';
import { waitForSlideReady } from './waitStrategies.js';
import { ensureDir } from '../utils/cleanup.js';
import logger from '../utils/logger.js';

const RESOLUTIONS = {
  '4k': { width: 3840, height: 2160 },
  hd: { width: 1920, height: 1080 },
};

const SLIDE_TIMEOUT = 30_000;

function padNumber(num, length = 3) {
  return String(num).padStart(length, '0');
}

export async function captureSlides({
  mode,
  htmlFiles,
  entryFile,
  staticServerUrl,
  resolution,
  outputDir,
  onProgress,
}) {
  const viewport = RESOLUTIONS[resolution];
  if (!viewport) {
    throw new Error(`Invalid resolution: ${resolution}`);
  }

  await ensureDir(outputDir);

  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
  });

  try {
    if (mode === 'A') {
      await captureModeA({
        context,
        entryFile,
        staticServerUrl,
        viewport,
        outputDir,
        onProgress,
      });
    } else {
      await captureModeB({
        context,
        htmlFiles,
        staticServerUrl,
        viewport,
        outputDir,
        onProgress,
      });
    }
  } finally {
    await context.close();
  }
}

async function captureModeA({
  context,
  entryFile,
  staticServerUrl,
  viewport,
  outputDir,
  onProgress,
}) {
  const page = await context.newPage();
  page.setDefaultTimeout(SLIDE_TIMEOUT);

  const url = `${staticServerUrl}/${entryFile}`;
  logger.info({ url }, 'Mode A: navigating to entry file');
  await page.goto(url, { waitUntil: 'load', timeout: SLIDE_TIMEOUT });
  await waitForSlideReady(page);

  // Count slide sections
  const slideCount = await page.evaluate(() => {
    return document.querySelectorAll('section.slide').length;
  });

  if (slideCount === 0) {
    throw new Error('No <section class="slide"> elements found in the page');
  }

  logger.info({ slideCount }, 'Mode A: capturing slide sections');

  for (let i = 0; i < slideCount; i++) {
    // Isolate current slide: hide all others, make current fill viewport
    await page.evaluate(
      ({ index, vw, vh }) => {
        const slides = document.querySelectorAll('section.slide');
        document.body.style.margin = '0';
        document.body.style.padding = '0';
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';

        slides.forEach((slide, si) => {
          if (si === index) {
            slide.style.display = 'block';
            slide.style.position = 'fixed';
            slide.style.top = '0';
            slide.style.left = '0';
            slide.style.width = `${vw}px`;
            slide.style.height = `${vh}px`;
            slide.style.overflow = 'hidden';
            slide.style.zIndex = '9999';
          } else {
            slide.style.display = 'none';
          }
        });

        window.scrollTo(0, 0);
      },
      { index: i, vw: viewport.width, vh: viewport.height }
    );

    await waitForSlideReady(page);

    const outputPath = path.join(outputDir, `slide-${padNumber(i + 1)}.png`);
    await page.screenshot({
      path: outputPath,
      type: 'png',
      clip: { x: 0, y: 0, width: viewport.width, height: viewport.height },
    });

    logger.debug({ slide: i + 1, total: slideCount }, 'Captured slide');
    onProgress(i + 1, slideCount);
  }

  await page.close();
}

async function captureModeB({
  context,
  htmlFiles,
  staticServerUrl,
  viewport,
  outputDir,
  onProgress,
}) {
  const page = await context.newPage();
  page.setDefaultTimeout(SLIDE_TIMEOUT);

  const total = htmlFiles.length;
  logger.info({ total }, 'Mode B: capturing multiple HTML files');

  for (let i = 0; i < total; i++) {
    const url = `${staticServerUrl}/${htmlFiles[i]}`;
    logger.debug({ url, slide: i + 1 }, 'Navigating to slide');

    await page.goto(url, { waitUntil: 'load', timeout: SLIDE_TIMEOUT });
    await waitForSlideReady(page);

    const outputPath = path.join(outputDir, `slide-${padNumber(i + 1)}.png`);
    await page.screenshot({
      path: outputPath,
      type: 'png',
      clip: { x: 0, y: 0, width: viewport.width, height: viewport.height },
    });

    logger.debug({ slide: i + 1, total }, 'Captured slide');
    onProgress(i + 1, total);
  }

  await page.close();
}

export { RESOLUTIONS };
