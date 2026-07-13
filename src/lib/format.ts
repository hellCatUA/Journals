/** Client-safe formatting helpers (no server imports). */

export function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
}

export function todayISO(): string {
  const now = new Date();
  return localDateISO(now);
}

export function nowTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function localDateISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function monthRange(year: number, month: number): { from: string; to: string } {
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}

/** ISO week (Monday-based) containing the given date. */
export function weekRange(d: Date): { from: string; to: string } {
  const day = (d.getDay() + 6) % 7; // 0 = Monday
  const monday = new Date(d);
  monday.setDate(d.getDate() - day);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { from: localDateISO(monday), to: localDateISO(sunday) };
}

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function formatDateShort(occurredAt: string): string {
  const [date, time] = occurredAt.split(' ');
  const [y, m, d] = date.split('-').map(Number);
  return `${MONTH_NAMES[m - 1].slice(0, 3)} ${d}, ${y}${time && time !== '00:00' ? ` · ${time}` : ''}`;
}
