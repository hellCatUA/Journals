import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { RECEIPTS_DIR } from './db';

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.pdf']);

function extensionFor(originalName: string, mimeType: string): string {
  const fromName = path.extname(originalName).toLowerCase();
  if (ALLOWED_EXT.has(fromName)) return fromName === '.jpeg' ? '.jpg' : fromName;
  const fromMime: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/heic': '.heic',
    'application/pdf': '.pdf',
  };
  return fromMime[mimeType] ?? '.jpg';
}

/** Folder layout: receipts/YY/MM/DD/, derived from the expense date. */
export function receiptDirFor(occurredAt: string): string {
  const [date] = occurredAt.split(' ');
  const [yyyy, mm, dd] = date.split('-');
  return path.join(yyyy.slice(2), mm, dd);
}

export async function saveReceipt(
  file: File,
  occurredAt: string
): Promise<string> {
  const relDir = receiptDirFor(occurredAt);
  const absDir = path.join(RECEIPTS_DIR, relDir);
  fs.mkdirSync(absDir, { recursive: true });

  const ext = extensionFor(file.name, file.type);
  const stamp = occurredAt.replace(/[^0-9]/g, '').slice(0, 12);
  const name = `${stamp}-${crypto.randomBytes(4).toString('hex')}${ext}`;
  const relPath = path.join(relDir, name);

  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(path.join(RECEIPTS_DIR, relPath), buffer);
  return relPath;
}

/** Resolve a stored relative path safely inside RECEIPTS_DIR. */
export function resolveReceiptPath(relPath: string): string | null {
  const abs = path.resolve(RECEIPTS_DIR, relPath);
  if (!abs.startsWith(path.resolve(RECEIPTS_DIR) + path.sep)) return null;
  return abs;
}

export function deleteReceipt(relPath: string): void {
  const abs = resolveReceiptPath(relPath);
  if (abs && fs.existsSync(abs)) {
    fs.unlinkSync(abs);
    cleanupEmptyDirs(path.dirname(abs));
  }
}

/** Move a receipt when the expense date changes so the YY/MM/DD layout stays truthful. */
export function moveReceipt(relPath: string, newOccurredAt: string): string {
  const oldAbs = resolveReceiptPath(relPath);
  if (!oldAbs || !fs.existsSync(oldAbs)) return relPath;

  const newRelDir = receiptDirFor(newOccurredAt);
  if (path.dirname(relPath) === newRelDir) return relPath;

  const newRelPath = path.join(newRelDir, path.basename(relPath));
  const newAbs = path.join(RECEIPTS_DIR, newRelPath);
  fs.mkdirSync(path.dirname(newAbs), { recursive: true });
  fs.renameSync(oldAbs, newAbs);
  cleanupEmptyDirs(path.dirname(oldAbs));
  return newRelPath;
}

function cleanupEmptyDirs(dir: string): void {
  const root = path.resolve(RECEIPTS_DIR);
  let current = path.resolve(dir);
  while (current.startsWith(root + path.sep)) {
    try {
      if (fs.readdirSync(current).length > 0) break;
      fs.rmdirSync(current);
    } catch {
      break;
    }
    current = path.dirname(current);
  }
}

export function receiptContentType(relPath: string): string {
  const ext = path.extname(relPath).toLowerCase();
  const map: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.heic': 'image/heic',
    '.pdf': 'application/pdf',
  };
  return map[ext] ?? 'application/octet-stream';
}
