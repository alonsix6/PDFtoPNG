import path from 'path';
import { getBrowser } from './browser.js';
import { waitForSlideReady } from './waitStrategies.js';
import { postProcessPng } from './postProcess.js';
import { ensureDir } from '../utils/cleanup.js';
import logger from '../utils/logger.js';

const SLIDE_TIMEOUT = 30_000;
const DEVICE_SCALE_FACTOR = 3;
const MAX_VIEWPORT_DIM = 8192;

function padNumber(num, length = 3) {
  return String(num).padStart(length, '0');
}

/**
 * Inject CSS for maximum font rendering quality.
 * Grayscale antialiasing looks crisp on any display and in Canva.
 */
async function injectQualityCSS(page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        -webkit-font-smoothing: antialiased !important;
        -moz-osx-font-smoothing: grayscale !important;
        text-rendering: optimizeLegibility !important;
      }
    `,
  });
}

/**
 * Auto-detect the slide dimensions and number of stacked pages from the HTML.
 *
 * Strategy priority:
 * 1. @page { size: WxH } CSS rule — most reliable for HTML presentations
 * 2. Stacked equal-height children — common slide layout pattern
 * 3. Aspect ratio heuristic (16:9, 4:3, 16:10) — last resort for multi-page
 * 4. Single full-page capture — ultimate fallback
 */
async function detectSlideDimensions(page) {
  // Strategy 1: Parse @page CSS rule and count slide elements
  const pageRuleInfo = await page.evaluate(() => {
    let pageWidth = 0;
    let pageHeight = 0;

    // Read @page { size } from stylesheets via CSSOM
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule instanceof CSSPageRule) {
            const match = rule.cssText.match(
              /@page\s*\{[^}]*size:\s*(\d+(?:\.\d+)?)px\s+(\d+(?:\.\d+)?)px/
            );
            if (match) {
              pageWidth = Math.round(parseFloat(match[1]));
              pageHeight = Math.round(parseFloat(match[2]));
            }
          }
        }
      } catch {
        // Skip cross-origin or inaccessible stylesheets
      }
    }

    if (!pageWidth || !pageHeight) {
      return null;
    }

    // Count slides: elements with page-break-after:always matching @page dimensions
    const allElements = document.body.querySelectorAll('*');
    let slideCount = 0;
    for (const el of allElements) {
      const style = getComputedStyle(el);
      const hasPageBreak =
        style.pageBreakAfter === 'always' || style.breakAfter === 'page';
      const matchesWidth = Math.abs(el.offsetWidth - pageWidth) <= 4;
      const matchesHeight = Math.abs(el.offsetHeight - pageHeight) <= 4;

      if (hasPageBreak && matchesWidth && matchesHeight) {
        slideCount++;
      }
    }

    // Fallback: if no page-break elements found, count visible body children
    // that match @page dimensions
    if (slideCount === 0) {
      const children = Array.from(document.body.children).filter((el) => {
        const style = getComputedStyle(el);
        return (
          style.display !== 'none' &&
          Math.abs(el.offsetWidth - pageWidth) <= 4 &&
          Math.abs(el.offsetHeight - pageHeight) <= 4
        );
      });
      slideCount = children.length;
    }

    return { pageWidth, pageHeight, slideCount: Math.max(slideCount, 1) };
  });

  if (pageRuleInfo) {
    const { pageWidth, pageHeight, slideCount } = pageRuleInfo;
    const width = Math.min(Math.max(pageWidth, 320), MAX_VIEWPORT_DIM);
    const slideHeight = Math.min(Math.max(pageHeight, 200), MAX_VIEWPORT_DIM);

    logger.info(
      { strategy: 'page-rule', width, slideHeight, slideCount },
      'Detected slide dimensions from @page CSS rule'
    );

    return { width, slideHeight, slideCount, totalHeight: slideHeight * slideCount };
  }

  // --- Fallback strategies (no @page rule found) ---

  // Measure intrinsic content dimensions
  const dims = await page.evaluate(() => {
    const body = document.body;
    const html = document.documentElement;

    const contentWidth = Math.max(
      body.scrollWidth, html.scrollWidth,
      body.offsetWidth, html.offsetWidth,
      body.clientWidth, html.clientWidth
    );

    const contentHeight = Math.max(
      body.scrollHeight, html.scrollHeight,
      body.offsetHeight, html.offsetHeight
    );

    return { contentWidth, contentHeight };
  });

  logger.info(dims, 'Raw content dimensions detected (no @page rule)');

  const width = Math.min(Math.max(dims.contentWidth, 320), MAX_VIEWPORT_DIM);
  const totalHeight = Math.min(Math.max(dims.contentHeight, 200), 100000);

  // Strategy 2: Stacked equal-height children
  const pageInfo = await page.evaluate(() => {
    const children = Array.from(document.body.children).filter((el) => {
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && el.offsetHeight > 50;
    });

    if (children.length <= 1) {
      return { strategy: 'single', childCount: children.length, childHeight: 0 };
    }

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

    return { strategy: 'none', childCount: children.length, childHeight: 0 };
  });

  logger.info(pageInfo, 'Page structure analysis');

  let slideHeight;
  let slideCount;

  if (pageInfo.strategy === 'stacked-children') {
    slideHeight = pageInfo.childHeight;
    slideCount = pageInfo.childCount;
  } else {
    // Strategy 3: Aspect ratio heuristic
    const ratios = [16 / 9, 4 / 3, 16 / 10];
    let bestMatch = null;

    for (const ratio of ratios) {
      const expectedHeight = Math.round(width / ratio);
      if (expectedHeight > 0 && totalHeight >= expectedHeight) {
        const pages = Math.round(totalHeight / expectedHeight);
        const remainder = Math.abs(totalHeight - pages * expectedHeight);
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
      // Strategy 4: Single full-page capture
      slideHeight = totalHeight;
      slideCount = 1;
    }
  }

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
  signal,
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
        signal,
        onProgress,
      });
    } else {
      await captureModeB({
        context,
        htmlFiles,
        staticServerUrl,
        outputDir,
        signal,
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
  signal,
  onProgress,
}) {
  const page = await context.newPage();
  page.setDefaultTimeout(SLIDE_TIMEOUT);

  const url = `${staticServerUrl}/${entryFile}`;
  logger.info({ url }, 'Mode A: navigating to entry file');
  await page.goto(url, { waitUntil: 'load', timeout: SLIDE_TIMEOUT });
  await waitForSlideReady(page);
  await injectQualityCSS(page);

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
    if (signal?.aborted) throw new Error('Job aborted');

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
    const pngBuffer = await page.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, width: vw, height: vh },
      animations: 'disabled',
      caret: 'hide',
    });
    await postProcessPng(pngBuffer, outputPath);

    logger.debug({ slide: i + 1, total: slideCount }, 'Captured slide');
    onProgress(i + 1, slideCount);
  }

  await page.close();
}

/**
 * Tag slide elements in the DOM with data-sf-slide attributes for element-level screenshots.
 * Returns the number of tagged slides.
 */
async function tagSlideElements(page, dims) {
  return page.evaluate(({ width, height }) => {
    let slides = [];

    // Strategy 1: elements with page-break-after matching @page dimensions
    const all = document.body.querySelectorAll('*');
    for (const el of all) {
      const style = getComputedStyle(el);
      const hasBreak =
        style.pageBreakAfter === 'always' || style.breakAfter === 'page';
      if (
        hasBreak &&
        Math.abs(el.offsetWidth - width) <= 4 &&
        Math.abs(el.offsetHeight - height) <= 4
      ) {
        slides.push(el);
      }
    }

    // Strategy 2: visible body children matching slide height
    if (slides.length === 0) {
      slides = Array.from(document.body.children).filter((el) => {
        const s = getComputedStyle(el);
        return s.display !== 'none' && Math.abs(el.offsetHeight - height) <= 4;
      });
    }

    // Strategy 3: all visible body children
    if (slides.length === 0) {
      slides = Array.from(document.body.children).filter((el) => {
        return getComputedStyle(el).display !== 'none' && el.offsetHeight > 50;
      });
    }

    slides.forEach((el, i) => el.setAttribute('data-sf-slide', String(i)));
    return slides.length;
  }, { width: dims.width, height: dims.slideHeight });
}

async function captureModeB({
  context,
  htmlFiles,
  staticServerUrl,
  outputDir,
  signal,
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

    // Navigate to the file again for capture — use tall viewport so all slides render
    await page.setViewportSize({ width: dims.width, height: 10000 });
    await page.goto(url, { waitUntil: 'load', timeout: SLIDE_TIMEOUT });
    await waitForSlideReady(page);
    await injectQualityCSS(page);

    // Normalize body layout so slides render cleanly
    await page.addStyleTag({
      content: 'body { margin: 0 !important; padding: 0 !important; gap: 0 !important; }',
    });

    // Tag slide elements for per-element screenshots
    const taggedCount = await tagSlideElements(page, dims);
    const slidesToCapture = taggedCount > 0 ? taggedCount : dims.slideCount;

    logger.debug({ taggedCount, slidesToCapture }, 'Tagged slide elements');

    for (let s = 0; s < slidesToCapture; s++) {
      if (signal?.aborted) throw new Error('Job aborted');

      const outputPath = path.join(outputDir, `slide-${padNumber(globalSlideIndex + 1)}.png`);

      let pngBuffer;
      if (taggedCount > 0) {
        // Element screenshot — captures exactly the slide element, no scroll math needed
        const slideEl = page.locator(`[data-sf-slide="${s}"]`);
        pngBuffer = await slideEl.screenshot({
          type: 'png',
          animations: 'disabled',
          caret: 'hide',
        });
      } else {
        // Fallback: scroll+clip for single-page HTML without identifiable slide elements
        const scrollY = s * dims.slideHeight;
        await page.evaluate((y) => window.scrollTo(0, y), scrollY);
        await page.waitForTimeout(100);
        pngBuffer = await page.screenshot({
          type: 'png',
          clip: { x: 0, y: 0, width: dims.width, height: dims.slideHeight },
          animations: 'disabled',
          caret: 'hide',
        });
      }

      await postProcessPng(pngBuffer, outputPath);

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
