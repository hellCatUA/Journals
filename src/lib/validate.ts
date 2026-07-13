import type { ExpenseInput } from './expenses';

export class ValidationError extends Error {}

const DATETIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;

/**
 * Parse and validate expense fields from a multipart form.
 * Amount arrives as a dollar string ("12.34") and is stored as integer cents.
 */
export function expenseInputFromForm(form: FormData): ExpenseInput {
  const amountRaw = String(form.get('amount') ?? '').trim().replace(',', '.');
  const amount = Number.parseFloat(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 9_999_999) {
    throw new ValidationError('Amount must be a positive number.');
  }
  const amount_cents = Math.round(amount * 100);

  const date = String(form.get('date') ?? '').trim();
  const time = String(form.get('time') ?? '00:00').trim() || '00:00';
  const occurred_at = `${date} ${time}`;
  if (!DATETIME_RE.test(occurred_at) || Number.isNaN(Date.parse(`${date}T${time}:00`))) {
    throw new ValidationError('Invalid date or time.');
  }

  const category_id = toNullableId(form.get('category_id'));
  const account_id = toNullableId(form.get('account_id'));

  const is_write_off = form.get('is_write_off') === '1' ? 1 : 0;
  let write_off_pct = 0;
  if (is_write_off) {
    write_off_pct = Number.parseInt(String(form.get('write_off_pct') ?? '100'), 10);
    if (!Number.isInteger(write_off_pct) || write_off_pct < 1 || write_off_pct > 100) {
      throw new ValidationError('Write-off % must be between 1 and 100.');
    }
  }

  const group_ids = String(form.get('group_ids') ?? '')
    .split(',')
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n) && n > 0);

  return {
    amount_cents,
    occurred_at,
    vendor: String(form.get('vendor') ?? '').trim().slice(0, 200),
    note: String(form.get('note') ?? '').trim().slice(0, 2000),
    category_id,
    account_id,
    is_write_off,
    write_off_pct,
    group_ids,
    ocr_text: strOrNull(form.get('ocr_text')),
  };
}

function toNullableId(value: FormDataEntryValue | null): number | null {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function strOrNull(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? '').trim();
  return s ? s.slice(0, 20000) : null;
}
