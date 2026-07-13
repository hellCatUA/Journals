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

export const WEEKDAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

export function formatDateShort(occurredAt: string): string {
  const [date, time] = occurredAt.split(' ');
  const [y, m, d] = date.split('-').map(Number);
  return `${MONTH_NAMES[m - 1].slice(0, 3)} ${d}, ${y}${time && time !== '00:00' ? ` · ${time}` : ''}`;
}

export function parseDateParts(dateStr: string): { y: number; m: number; d: number } {
  const [y, m, d] = dateStr.split('-').map(Number);
  return { y, m, d };
}

/** Monday (ISO week start) of the week containing the given date. */
export function mondayOf(dateStr: string): string {
  const { y, m, d } = parseDateParts(dateStr);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
  return localDateISO(dt);
}

/** "Jul 7" */
export function shortDate(dateStr: string): string {
  const { m, d } = parseDateParts(dateStr);
  return `${MONTH_NAMES[m - 1].slice(0, 3)} ${d}`;
}

/** Day heading: "Today · Jul 13", "Yesterday · Jul 12", "Tuesday · Jul 8", "Friday · Dec 19, 2025" */
export function dayLabel(dateStr: string, todayStr: string): string {
  const { y, m, d } = parseDateParts(dateStr);
  const yesterday = new Date();
  const [ty, tm, td] = todayStr.split('-').map(Number);
  yesterday.setFullYear(ty, tm - 1, td - 1);

  let prefix = WEEKDAY_NAMES[new Date(y, m - 1, d).getDay()];
  if (dateStr === todayStr) prefix = 'Today';
  else if (dateStr === localDateISO(yesterday)) prefix = 'Yesterday';

  const sameYear = dateStr.slice(0, 4) === todayStr.slice(0, 4);
  return `${prefix} · ${MONTH_NAMES[m - 1].slice(0, 3)} ${d}${sameYear ? '' : `, ${y}`}`;
}

/** Week label from its Monday: "Jul 7 – 13" or "Jun 30 – Jul 6" */
export function weekLabel(mondayStr: string): string {
  const { y, m, d } = parseDateParts(mondayStr);
  const sunday = new Date(y, m - 1, d + 6);
  const sameMonth = sunday.getMonth() === m - 1;
  return sameMonth
    ? `${MONTH_NAMES[m - 1].slice(0, 3)} ${d} – ${sunday.getDate()}`
    : `${MONTH_NAMES[m - 1].slice(0, 3)} ${d} – ${MONTH_NAMES[sunday.getMonth()].slice(0, 3)} ${sunday.getDate()}`;
}
