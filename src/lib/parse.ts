/**
 * Heuristics that turn raw receipt OCR text into structured fields.
 * OCR output is noisy, so everything here is best-effort: the UI always
 * lets the user review and correct before saving.
 */

const TOTAL_KEYWORDS =
  /(grand\s*total|total\s*due|amount\s*due|balance\s*due|total\s*amount|total|amount|to\s*pay)/i;
const ANTI_KEYWORDS = /(sub\s*-?total|tax|tip|change|cash\s*back|savings|discount|item)/i;

const MONEY_RE = /(?:\$|usd\s?)?(\d{1,5}(?:[ ,]\d{3})*[.,]\d{2})(?!\d)/gi;

function toCentsString(raw: string): string | null {
  const cleaned = raw.replace(/[ ,](?=\d{3})/g, '').replace(',', '.');
  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value) || value <= 0 || value > 99999.99) return null;
  return value.toFixed(2);
}

export function parseAmount(text: string): string | null {
  const lines = text.split('\n');
  let keywordBest: { value: number; str: string } | null = null;
  let overallMax: { value: number; str: string } | null = null;

  for (const line of lines) {
    const matches = [...line.matchAll(MONEY_RE)];
    for (const m of matches) {
      const str = toCentsString(m[1]);
      if (!str) continue;
      const value = Number.parseFloat(str);
      if (!overallMax || value > overallMax.value) overallMax = { value, str };
      if (TOTAL_KEYWORDS.test(line) && !ANTI_KEYWORDS.test(line)) {
        // Prefer the last (usually rightmost/most specific) total on the receipt.
        if (!keywordBest || value >= keywordBest.value) keywordBest = { value, str };
      }
    }
  }

  return keywordBest?.str ?? overallMax?.str ?? null;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function validDate(y: number, m: number, d: number): string | null {
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function parseDate(text: string): string | null {
  // ISO: 2026-07-13
  let m = text.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (m) {
    const result = validDate(+m[1], +m[2], +m[3]);
    if (result) return result;
  }

  // US style: 07/13/2026 or 07/13/26 (also tolerates 13/07/2026 by swapping)
  m = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2}|\d{2})\b/);
  if (m) {
    const year = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return validDate(year, +m[1], +m[2]) ?? validDate(year, +m[2], +m[1]);
  }

  // Textual: Jul 13, 2026 / 13 Jul 2026
  m = text.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(20\d{2})\b/i);
  if (m) {
    const result = validDate(+m[3], MONTHS[m[1].toLowerCase()], +m[2]);
    if (result) return result;
  }
  m = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s+(20\d{2})\b/i);
  if (m) {
    const result = validDate(+m[3], MONTHS[m[2].toLowerCase()], +m[1]);
    if (result) return result;
  }

  return null;
}

export function parseTime(text: string): string | null {
  const m = text.match(/\b(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?\b/i);
  if (!m) return null;
  let hours = +m[1];
  const minutes = +m[2];
  if (minutes > 59) return null;
  const meridiem = m[3]?.toLowerCase();
  if (meridiem === 'pm' && hours < 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;
  if (hours > 23) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function parseVendor(text: string): string | null {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines.slice(0, 6)) {
    const letters = (line.match(/[a-z]/gi) ?? []).length;
    const digits = (line.match(/\d/g) ?? []).length;
    // A plausible store name: mostly letters, not an address/phone line.
    if (letters >= 3 && letters > digits * 2 && line.length <= 48 && !/receipt|invoice|welcome|thank/i.test(line)) {
      return line.replace(/\s{2,}/g, ' ');
    }
  }
  return null;
}

export function parseReceiptText(text: string): {
  amount: string | null;
  date: string | null;
  time: string | null;
  vendor: string | null;
} {
  return {
    amount: parseAmount(text),
    date: parseDate(text),
    time: parseTime(text),
    vendor: parseVendor(text),
  };
}
