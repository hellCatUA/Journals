import { execFile } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import sharp from 'sharp';
import { parseReceiptText } from './parse';
import type { OcrResult } from './types';

const execFileAsync = promisify(execFile);

const OCR_LANGS = process.env.OCR_LANGS || 'eng';

export class OcrUnavailableError extends Error {}

async function tesseractAvailable(): Promise<boolean> {
  try {
    await execFileAsync('tesseract', ['--version']);
    return true;
  } catch {
    return false;
  }
}

/**
 * Clean the photo up before OCR: fix EXIF rotation, drop color,
 * boost contrast and upscale small phone shots. Makes a big
 * difference for Tesseract on real receipt photos.
 */
async function preprocess(input: Buffer): Promise<Buffer> {
  const image = sharp(input).rotate();
  const meta = await image.metadata();
  const width = meta.width ?? 0;

  let pipeline = image.grayscale().normalise().sharpen();
  if (width > 0 && width < 1200) {
    pipeline = pipeline.resize({ width: Math.min(width * 2, 2400) });
  } else if (width > 2600) {
    pipeline = pipeline.resize({ width: 2600 });
  }
  return pipeline.png().toBuffer();
}

export async function runOcr(imageBuffer: Buffer): Promise<OcrResult> {
  if (!(await tesseractAvailable())) {
    throw new OcrUnavailableError(
      'Tesseract binary not found. Install tesseract-ocr (it is included in the Docker image).'
    );
  }

  const tmpFile = path.join(os.tmpdir(), `receipt-ocr-${crypto.randomBytes(6).toString('hex')}.png`);
  try {
    const processed = await preprocess(imageBuffer);
    fs.writeFileSync(tmpFile, processed);

    const { stdout } = await execFileAsync(
      'tesseract',
      [tmpFile, 'stdout', '--psm', '6', '-l', OCR_LANGS],
      { maxBuffer: 10 * 1024 * 1024, timeout: 60_000 }
    );

    const text = stdout.trim();
    return { text, ...parseReceiptText(text) };
  } finally {
    fs.rmSync(tmpFile, { force: true });
  }
}
