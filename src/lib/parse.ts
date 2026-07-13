/**
 * Heuristics that turn raw receipt OCR text into structured fields.
 * OCR output is noisy, so everything here is best-effort: the UI always
 * lets the user review and correct before saving.
 */

const TOTAL_KEYWORDS =
  /(grand\s*total|total\s*due|amount\s*due|balance\s*due|total\s*amount|total|amount|to\s*pay|balance)/i;
const ANTI_KEYWORDS = /(sub\s*-?total|tax|tip|change|cash\s*back|savings|discount|item|point|reward)/i;

const MONEY_RE = /(?:\$|usd\s?)?(\d{1,5}(?:[ ,]\d{3})*[.,]\d{2})(?!\d)/gi;
// Fallback for keyword lines where OCR lost the decimal separator: "TOTAL 82 90".
const SPACED_MONEY_RE = /(?:\$|usd\s?)?(\d{1,5}) (\d{2})(?!\d)/i;

/** Fix classic OCR letter/digit confusions next to digits: O→0, l/I→1. */
function normalizeDigits(line: string): string {
  let prev = '';
  let current = line;
  while (prev !== current) {
    prev = current;
    current = current
      .replace(/(\d)[Oo]/g, '$10')
      .replace(/[Oo](\d)/g, '0$1')
      .replace(/(\d)[lI]/g, '$11')
      .replace(/[lI](\d)/g, '1$1');
  }
  return current;
}

function toAmountString(raw: string): string | null {
  const cleaned = raw.replace(/[ ,](?=\d{3})/g, '').replace(',', '.');
  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value) || value <= 0 || value > 99999.99) return null;
  return value.toFixed(2);
}

function moneyOnLine(line: string): string[] {
  return [...normalizeDigits(line).matchAll(MONEY_RE)]
    .map((m) => toAmountString(m[1]))
    .filter((s): s is string => s !== null);
}

export function parseAmount(text: string): string | null {
  const lines = text.split('\n');
  let keywordBest: { value: number; str: string } | null = null;
  let overallMax: { value: number; str: string } | null = null;

  const consider = (str: string, isKeyword: boolean) => {
    const value = Number.parseFloat(str);
    if (!overallMax || value > overallMax.value) overallMax = { value, str };
    // Prefer the last / largest total mentioned on the receipt.
    if (isKeyword && (!keywordBest || value >= keywordBest.value)) keywordBest = { value, str };
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isKeywordLine = TOTAL_KEYWORDS.test(line) && !ANTI_KEYWORDS.test(line);
    const amounts = moneyOnLine(line);

    for (const str of amounts) consider(str, isKeywordLine);

    if (isKeywordLine && amounts.length === 0) {
      // "TOTAL 82 90" — decimal point lost by OCR.
      const spaced = normalizeDigits(line).match(SPACED_MONEY_RE);
      if (spaced) {
        const str = toAmountString(`${spaced[1]}.${spaced[2]}`);
        if (str) {
          consider(str, true);
          continue;
        }
      }
      // "TOTAL" on its own line with the amount printed on the next one.
      const next = lines[i + 1];
      if (next && !TOTAL_KEYWORDS.test(next)) {
        for (const str of moneyOnLine(next)) consider(str, true);
      }
    }
  }

  return (keywordBest as { str: string } | null)?.str ?? (overallMax as { str: string } | null)?.str ?? null;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};
const MONTH_RE = '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)';

function validDate(y: number, m: number, d: number): string | null {
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function fullYear(raw: string): number {
  return raw.length === 2 ? 2000 + Number(raw) : Number(raw);
}

export function parseDate(text: string): string | null {
  const t = normalizeDigits(text);

  // ISO: 2026-07-13
  let m = t.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (m) {
    const result = validDate(+m[1], +m[2], +m[3]);
    if (result) return result;
  }

  // US style: 07/13/2026 or 07/13/26 (also tolerates 13/07/2026 by swapping)
  m = t.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2}|\d{2})\b/);
  if (m) {
    const year = fullYear(m[3]);
    return validDate(year, +m[1], +m[2]) ?? validDate(year, +m[2], +m[1]);
  }

  // Textual: Jul 13, 2026 / Jul 13 '26
  m = t.match(new RegExp(`\\b${MONTH_RE}[a-z]*\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+'?(20\\d{2}|\\d{2})\\b`, 'i'));
  if (m) {
    const result = validDate(fullYear(m[3]), MONTHS[m[1].toLowerCase()], +m[2]);
    if (result) return result;
  }

  // Textual: 13 Jul 2026 / 13-JUL-26
  m = t.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?[-/. ]${MONTH_RE}[a-z]*\\.?,?[-/. ]'?(20\\d{2}|\\d{2})\\b`, 'i'));
  if (m) {
    const result = validDate(fullYear(m[3]), MONTHS[m[2].toLowerCase()], +m[1]);
    if (result) return result;
  }

  return null;
}

export function parseTime(text: string): string | null {
  const m = normalizeDigits(text).match(/\b(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?\b/i);
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
