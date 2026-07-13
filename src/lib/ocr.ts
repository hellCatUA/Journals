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

function upscale(pipeline: sharp.Sharp, width: number): sharp.Sharp {
  if (width > 0 && width < 1200) return pipeline.resize({ width: Math.min(width * 2, 2400) });
  if (width > 2600) return pipeline.resize({ width: 2600 });
  return pipeline;
}

/**
 * Two cleanup strategies: receipts differ (crumpled paper, shadows, thermal
 * fading), so we prepare a "soft" grayscale variant and a hard black/white
 * binarized variant and let confidence scoring decide which read was better.
 */
async function preprocessVariants(input: Buffer): Promise<Buffer[]> {
  const meta = await sharp(input).metadata();
  const width = meta.width ?? 0;

  const soft = upscale(sharp(input).rotate().grayscale().normalise().sharpen(), width)
    .png()
    .toBuffer();

  const binary = upscale(sharp(input).rotate().grayscale().median(3).normalise().threshold(165), width)
    .png()
    .toBuffer();

  return Promise.all([soft, binary]);
}

interface OcrRun {
  text: string;
  meanConf: number;
  words: number;
  score: number;
}

/**
 * Run tesseract with TSV output so we get per-word confidence along with
 * the text. Lines are rebuilt from word rows.
 */
async function runTesseract(imagePath: string, psm: number): Promise<OcrRun> {
  const { stdout } = await execFileAsync(
    'tesseract',
    [imagePath, 'stdout', '--psm', String(psm), '-l', OCR_LANGS, 'tsv'],
    { maxBuffer: 20 * 1024 * 1024, timeout: 60_000 }
  );

  const lines: string[] = [];
  let currentKey = '';
  let currentWords: string[] = [];
  let confSum = 0;
  let confCount = 0;

  for (const row of stdout.split('\n').slice(1)) {
    const cols = row.split('\t');
    if (cols.length < 12) continue;
    const [level, , block, par, line, , , , , , conf, text] = cols;
    if (level !== '5') continue; // word rows only
    const word = text.trim();
    if (!word) continue;

    const key = `${block}:${par}:${line}`;
    if (key !== currentKey) {
      if (currentWords.length) lines.push(currentWords.join(' '));
      currentKey = key;
      currentWords = [];
    }
    currentWords.push(word);

    const c = Number.parseFloat(conf);
    if (Number.isFinite(c) && c > 0) {
      confSum += c;
      confCount += 1;
    }
  }
  if (currentWords.length) lines.push(currentWords.join(' '));

  const meanConf = confCount ? confSum / confCount : 0;
  // Penalize runs that recognized almost nothing so a confident 3-word
  // garbage read doesn't beat a full-page read.
  const score = meanConf * Math.min(1, confCount / 8);
  return { text: lines.join('\n'), meanConf, words: confCount, score };
}

export async function runOcr(imageBuffer: Buffer): Promise<OcrResult> {
  if (!(await tesseractAvailable())) {
    throw new OcrUnavailableError(
      'Tesseract binary not found. Install tesseract-ocr (it is included in the Docker image).'
    );
  }

  const stamp = crypto.randomBytes(6).toString('hex');
  const tmpFiles: string[] = [];
  try {
    const variants = await preprocessVariants(imageBuffer);
    const paths = variants.map((buf, i) => {
      const p = path.join(os.tmpdir(), `receipt-ocr-${stamp}-${i}.png`);
      fs.writeFileSync(p, buf);
      tmpFiles.push(p);
      return p;
    });

    // PSM 6 = uniform text block, PSM 4 = column of variable-size lines.
    // Both are plausible for receipts; the binarized variant gets one shot.
    const attempts: Array<[string, number]> = [
      [paths[0], 6],
      [paths[0], 4],
      [paths[1], 6],
    ];

    let best: OcrRun | null = null;
    for (const [imagePath, psm] of attempts) {
      try {
        const run = await runTesseract(imagePath, psm);
        if (!best || run.score > best.score) best = run;
      } catch (err) {
        console.error(`OCR attempt failed (psm ${psm}):`, err);
      }
    }

    if (!best || !best.text.trim()) {
      return { text: '', amount: null, date: null, time: null, vendor: null };
    }

    return { text: best.text, ...parseReceiptText(best.text) };
  } finally {
    for (const f of tmpFiles) fs.rmSync(f, { force: true });
  }
}
