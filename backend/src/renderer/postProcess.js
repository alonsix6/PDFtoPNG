import sharp from 'sharp';
import logger from '../utils/logger.js';

/**
 * Post-process a PNG buffer through Sharp for optimal quality output.
 * - compressionLevel 6: standard lossless compression (PNG is always lossless)
 * - adaptiveFiltering: better filter selection per scanline
 * - Pipeline ready for future enhancements (Lanczos downscale, etc.)
 */
export async function postProcessPng(pngBuffer, outputPath) {
  const result = await sharp(pngBuffer, { failOn: 'none' })
    .png({
      compressionLevel: 6,
      adaptiveFiltering: true,
    })
    .toFile(outputPath);

  logger.debug(
    { outputPath, size: result.size, width: result.width, height: result.height },
    'Post-processed PNG'
  );

  return result;
}
