/**
 * Copies the monochrome Lucide icon set from lucide-static into public/icons
 * and generates public/icons/index.json (sorted icon names) for the
 * searchable icon picker. Runs automatically before `next dev` / `next build`.
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const srcDir = path.join(path.dirname(require.resolve('lucide-static/package.json')), 'icons');
const destDir = path.join(process.cwd(), 'public', 'icons');

fs.mkdirSync(destDir, { recursive: true });

const names = [];
for (const file of fs.readdirSync(srcDir)) {
  if (!file.endsWith('.svg')) continue;
  names.push(file.slice(0, -4));
  fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
}

names.sort();
fs.writeFileSync(path.join(destDir, 'index.json'), JSON.stringify(names));
console.log(`copy-icons: ${names.length} icons -> public/icons`);
