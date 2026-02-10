import fs from 'fs/promises';
import path from 'path';
import logger from '../utils/logger.js';

const SLIDE_SECTION_REGEX = /<section[^>]*class="[^"]*slide[^"]*"/gi;

export async function detectSlides(rootDir) {
  const htmlFiles = await findHtmlFiles(rootDir);

  if (htmlFiles.length === 0) {
    throw new Error('No HTML files found in the project');
  }

  // Check for index.html with slide sections (Mode A)
  const indexFile = htmlFiles.find(
    (f) => path.basename(f).toLowerCase() === 'index.html'
  );

  if (indexFile) {
    const content = await fs.readFile(indexFile, 'utf-8');
    const matches = content.match(SLIDE_SECTION_REGEX);

    if (matches && matches.length > 0) {
      logger.info(
        { mode: 'A', slideCount: matches.length, entryFile: indexFile },
        'Detected Mode A: single HTML with slide sections'
      );
      return {
        mode: 'A',
        htmlFiles: [indexFile],
        entryFile: path.relative(rootDir, indexFile),
        slideCount: matches.length,
      };
    }
  }

  // Mode B: multiple HTML files
  const sorted = htmlFiles.sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  );

  logger.info(
    { mode: 'B', slideCount: sorted.length },
    'Detected Mode B: multiple HTML files'
  );

  return {
    mode: 'B',
    htmlFiles: sorted.map((f) => path.relative(rootDir, f)),
    slideCount: sorted.length,
  };
}

async function findHtmlFiles(dir) {
  const results = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip hidden directories and common non-slide directories
      if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
        const nested = await findHtmlFiles(fullPath);
        results.push(...nested);
      }
    } else if (entry.name.toLowerCase().endsWith('.html')) {
      results.push(fullPath);
    }
  }

  return results;
}
