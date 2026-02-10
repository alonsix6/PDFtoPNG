import path from 'path';
import { getBrowser } from './browser.js';
import { waitForSlideReady } from './waitStrategies.js';
import { ensureDir } from '../utils/cleanup.js';
import logger from '../utils/logger.js';

const SLIDE_TIMEOUT = 30_000;
const DEVICE_SCALE_FACTOR = 2;
const MAX_VIEWPORT_DIM = 8192;

function padNumber(num, length = 3) {
  return String(num).padStart(length, '0');
}

/**
 * Auto-detect the slide dimensions and number of stacked pages from the HTML.
 * Opens with a tall viewport to measure total content height, then determines
 * if the content is a stack of equally-sized pages.
 */
async function detectSlideDimensions(page) {
  // Measure the intrinsic content dimensions
  const dims = await page.evaluate(() => {
    const body = document.body;
    const html = document.documentElement;

    // Content width: use the natural width of the content
    const contentWidth = Math.max(
      body.scrollWidth,
      html.scrollWidth,
      body.offsetWidth,
      html.offsetWidth,
      body.clientWidth,
      html.clientWidth
    );

    // Content height: full scrollable height
    const contentHeight = Math.max(
      body.scrollHeight,
      html.scrollHeight,
      body.offsetHeight,
      html.offsetHeight
    );

    return { contentWidth, contentHeight };
  });

  logger.info(dims, 'Raw content dimensions detected');

  // Clamp to reasonable bounds
  const width = Math.min(Math.max(dims.contentWidth, 320), MAX_VIEWPORT_DIM);
  const totalHeight = Math.min(Math.max(dims.contentHeight, 200), 100000);

  // Try to detect stacked pages: look for repeating sections of equal height.
  // Common approach: body's direct children are the pages, all with the same height.
  const pageInfo = await page.evaluate(() => {
    // Strategy 1: check direct children of body
    const children = Array.from(document.body.children).filter((el) => {
      const style = window.getComputedStyle(el);
      // Ignore hidden/zero-height elements
      return style.display !== 'none' && el.offsetHeight > 50;
    });

    if (children.length <= 1) {
      return { strategy: 'single', childCount: children.length, childHeight: 0 };
    }

    // Check if all children have similar height (within 2px tolerance)
    const heights = children.map((el) => el.offsetHeight);
    const firstHeight = heights[0];
    const allSameHeight = heights.every((h) => Math.abs(h - firstHeight) <= 2);

    if (allSameHeight && firstHeight > 50) {
      return {
        strategy: 'stacked-children',
        childCount: children.length,
        childHeight: firstHeight,
      };
    }

    // Strategy 2: check if total height is a clean multiple of viewport-like height
    // (for cases where slides are laid out without wrapper elements)
    return { strategy: 'none', childCount: children.length, childHeight: 0 };
  });

  logger.info(pageInfo, 'Page structure analysis');

  let slideHeight;
  let slideCount;

  if (pageInfo.strategy === 'stacked-children') {
    // Direct children are the pages
    slideHeight = pageInfo.childHeight;
    slideCount = pageInfo.childCount;
  } else {
    // Try to detect via common aspect ratios (16:9, 4:3, 16:10)
    const ratios = [16 / 9, 4 / 3, 16 / 10];
    let bestMatch = null;

    for (const ratio of ratios) {
      const expectedHeight = Math.round(width / ratio);
      if (expectedHeight > 0 && totalHeight >= expectedHeight) {
        const pages = Math.round(totalHeight / expectedHeight);
        const remainder = Math.abs(totalHeight - pages * expectedHeight);
        // Allow up to 10px tolerance per page
        if (remainder <= pages * 10) {
          if (!bestMatch || Math.abs(remainder) < Math.abs(bestMatch.remainder)) {
            bestMatch = { height: expectedHeight, count: pages, remainder };
          }
        }
      }
    }

    if (bestMatch && bestMatch.count > 1) {
      slideHeight = bestMatch.height;
      slideCount = bestMatch.count;
    } else {
      // Fallback: treat as a single full-page capture
      slideHeight = totalHeight;
      slideCount = 1;
    }
  }

  // Clamp slide dimensions
  slideHeight = Math.min(slideHeight, MAX_VIEWPORT_DIM);

  logger.info(
    { width, slideHeight, slideCount, totalHeight },
    'Detected slide dimensions'
  );

  return { width, slideHeight, slideCount, totalHeight };
}

export async function captureSlides({
  mode,
  htmlFiles,
  entryFile,
  staticServerUrl,
  outputDir,
  onProgress,
}) {
  await ensureDir(outputDir);

  const browser = await getBrowser();

  // Use a large initial viewport to measure content without clipping
  const context = await browser.newContext({
    viewport: { width: 1920, height: 10000 },
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
  });

  try {
    if (mode === 'A') {
      await captureModeA({
        context,
        entryFile,
        staticServerUrl,
        outputDir,
        onProgress,
      });
    } else {
      await captureModeB({
        context,
        htmlFiles,
        staticServerUrl,
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

  // Detect the dimensions of the first slide section
  const slideDims = await page.evaluate(() => {
    const firstSlide = document.querySelector('section.slide');
    return {
      width: firstSlide.scrollWidth || firstSlide.offsetWidth,
      height: firstSlide.scrollHeight || firstSlide.offsetHeight,
    };
  });

  const vw = Math.min(Math.max(slideDims.width, 320), MAX_VIEWPORT_DIM);
  const vh = Math.min(Math.max(slideDims.height, 200), MAX_VIEWPORT_DIM);

  logger.info({ slideCount, vw, vh }, 'Mode A: capturing slide sections');

  // Resize viewport to match slide dimensions
  await page.setViewportSize({ width: vw, height: vh });

  for (let i = 0; i < slideCount; i++) {
    // Isolate current slide: hide all others, make current fill viewport
    await page.evaluate(
      ({ index, width, height }) => {
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
            slide.style.width = `${width}px`;
            slide.style.height = `${height}px`;
            slide.style.overflow = 'hidden';
            slide.style.zIndex = '9999';
          } else {
            slide.style.display = 'none';
          }
        });

        window.scrollTo(0, 0);
      },
      { index: i, width: vw, height: vh }
    );

    await waitForSlideReady(page);

    const outputPath = path.join(outputDir, `slide-${padNumber(i + 1)}.png`);
    await page.screenshot({
      path: outputPath,
      type: 'png',
      clip: { x: 0, y: 0, width: vw, height: vh },
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
  outputDir,
  onProgress,
}) {
  const page = await context.newPage();
  page.setDefaultTimeout(SLIDE_TIMEOUT);

  let globalSlideIndex = 0;
  let totalSlides = 0;

  // First pass: count total slides across all HTML files
  // For efficiency, we'll estimate during first pass and update
  logger.info({ fileCount: htmlFiles.length }, 'Mode B: scanning HTML files');

  // Scan each file to count total slides
  const fileSlideCounts = [];
  for (let i = 0; i < htmlFiles.length; i++) {
    const url = `${staticServerUrl}/${htmlFiles[i]}`;
    await page.goto(url, { waitUntil: 'load', timeout: SLIDE_TIMEOUT });
    await waitForSlideReady(page);

    const dims = await detectSlideDimensions(page);
    fileSlideCounts.push(dims);
    totalSlides += dims.slideCount;
  }

  logger.info({ totalSlides, fileCount: htmlFiles.length }, 'Mode B: total slides detected');

  // Second pass: capture all slides
  for (let i = 0; i < htmlFiles.length; i++) {
    const url = `${staticServerUrl}/${htmlFiles[i]}`;
    const dims = fileSlideCounts[i];

    logger.debug(
      { url, file: i + 1, slides: dims.slideCount, width: dims.width, height: dims.slideHeight },
      'Capturing file'
    );

    // Navigate to the file again for capture
    await page.setViewportSize({ width: dims.width, height: dims.slideHeight });
    await page.goto(url, { waitUntil: 'load', timeout: SLIDE_TIMEOUT });
    await waitForSlideReady(page);

    for (let s = 0; s < dims.slideCount; s++) {
      // Scroll to the correct position for this slide
      const scrollY = s * dims.slideHeight;
      await page.evaluate((y) => window.scrollTo(0, y), scrollY);

      // Brief settle after scroll
      await page.waitForTimeout(100);

      const outputPath = path.join(outputDir, `slide-${padNumber(globalSlideIndex + 1)}.png`);
      await page.screenshot({
        path: outputPath,
        type: 'png',
        clip: { x: 0, y: 0, width: dims.width, height: dims.slideHeight },
      });

      globalSlideIndex++;
      logger.debug(
        { slide: globalSlideIndex, total: totalSlides },
        'Captured slide'
      );
      onProgress(globalSlideIndex, totalSlides);
    }
  }

  await page.close();
}
