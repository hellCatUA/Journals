import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export class PdfUnavailableError extends Error {}

async function pdftoppmAvailable(): Promise<boolean> {
  try {
    await execFileAsync('pdftoppm', ['-v']);
    return true;
  } catch {
    return false;
  }
}

/**
 * Render the first page of a PDF to PNG via poppler's pdftoppm.
 * Used both for OCR on PDF receipts and for on-the-fly previews.
 */
export async function pdfFirstPageToPng(pdf: Buffer, dpi = 200): Promise<Buffer> {
  if (!(await pdftoppmAvailable())) {
    throw new PdfUnavailableError(
      'pdftoppm binary not found. Install poppler-utils (it is included in the Docker image).'
    );
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'receipt-pdf-'));
  const inPath = path.join(dir, 'in.pdf');
  try {
    fs.writeFileSync(inPath, pdf);
    await execFileAsync(
      'pdftoppm',
      ['-png', '-r', String(dpi), '-f', '1', '-l', '1', '-singlefile', inPath, path.join(dir, 'page')],
      { timeout: 30_000 }
    );
    return fs.readFileSync(path.join(dir, 'page.png'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

export function isPdf(name: string, mimeType: string): boolean {
  return mimeType === 'application/pdf' || name.toLowerCase().endsWith('.pdf');
}
