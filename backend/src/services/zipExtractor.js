import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs/promises';
import logger from '../utils/logger.js';
import { ensureDir } from '../utils/cleanup.js';

const SKIP_PATTERNS = ['__MACOSX', '.DS_Store', 'Thumbs.db'];

function shouldSkip(entryName) {
  return SKIP_PATTERNS.some(
    (pattern) => entryName.includes(pattern) || entryName.startsWith('.')
  );
}

export async function extractZip(zipBuffer, destDir) {
  await ensureDir(destDir);
  const resolvedDest = path.resolve(destDir) + path.sep;

  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();

  // Zip Slip protection: validate every entry path
  for (const entry of entries) {
    if (shouldSkip(entry.entryName)) continue;
    const target = path.resolve(destDir, entry.entryName);
    if (!target.startsWith(resolvedDest)) {
      throw new Error(`Zip path traversal detected: ${entry.entryName}`);
    }
  }

  // Extract valid entries
  const extractedFiles = [];
  for (const entry of entries) {
    if (shouldSkip(entry.entryName)) continue;
    const target = path.resolve(destDir, entry.entryName);

    if (entry.isDirectory) {
      await ensureDir(target);
    } else {
      await ensureDir(path.dirname(target));
      await fs.writeFile(target, entry.getData());
      extractedFiles.push(entry.entryName);
    }
  }

  // Detect root folder pattern: if all files share one top-level directory
  const rootDir = detectRootFolder(extractedFiles, destDir);

  // Validate at least one HTML file exists
  const htmlFiles = extractedFiles.filter((f) =>
    f.toLowerCase().endsWith('.html')
  );
  if (htmlFiles.length === 0) {
    throw new Error('No HTML files found in the ZIP archive');
  }

  logger.info(
    { fileCount: extractedFiles.length, htmlCount: htmlFiles.length, rootDir },
    'ZIP extracted successfully'
  );

  return { files: extractedFiles, rootDir };
}

function detectRootFolder(files, destDir) {
  if (files.length === 0) return destDir;

  const topLevelDirs = new Set();
  for (const file of files) {
    const parts = file.split('/');
    if (parts.length > 1) {
      topLevelDirs.add(parts[0]);
    }
  }

  // If all files are under a single top-level directory, use it as the root
  if (topLevelDirs.size === 1) {
    const singleRoot = path.join(destDir, [...topLevelDirs][0]);
    return singleRoot;
  }

  return destDir;
}
