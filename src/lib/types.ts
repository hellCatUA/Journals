export type WriteOffPolicy = 'full' | 'partial' | 'none';

export interface Account {
  id: number;
  name: string;
  kind: 'card' | 'cash' | 'bank' | 'other';
  archived: 0 | 1;
}

export interface Category {
  id: number;
  name: string;
  write_off: WriteOffPolicy;
  default_write_off_pct: number;
  color: string;
  icon: string; // Lucide icon name, '' = none
  archived: 0 | 1;
}

export interface Group {
  id: number;
  name: string;
  kind: 'project' | 'client' | 'trip' | 'other';
  note: string;
  created_at: string;
}

export interface Expense {
  id: number;
  amount_cents: number;
  currency: string;
  occurred_at: string; // "YYYY-MM-DD HH:MM"
  vendor: string;
  note: string;
  category_id: number | null;
  account_id: number | null;
  is_write_off: 0 | 1;
  write_off_pct: number;
  receipt_path: string | null;
  ocr_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseRow extends Expense {
  category_name: string | null;
  category_color: string | null;
  category_icon: string | null;
  category_write_off: WriteOffPolicy | null;
  account_name: string | null;
  group_ids: number[];
  group_names: string[];
  evidence_paths: string | null; // '; '-joined supporting evidence paths
}

export interface Attachment {
  id: number;
  expense_id: number;
  path: string;
  original_name: string;
  created_at: string;
}

/** Full expense as returned by the single-expense endpoints. */
export interface ExpenseDetail extends ExpenseRow {
  attachments: Attachment[];
}

export interface VendorSuggestion {
  vendor: string;
  uses: number;
  category_id: number | null;
  category_name: string | null;
  account_id: number | null;
}

export interface ExpenseStats {
  count: number;
  total_cents: number;
  write_off_cents: number;
}

export interface GroupWithStats extends Group {
  expense_count: number;
  total_cents: number;
  write_off_cents: number;
}

export interface OcrResult {
  text: string;
  amount: string | null; // "12.34" dollars
  date: string | null; // "YYYY-MM-DD"
  time: string | null; // "HH:MM"
  vendor: string | null;
}

export function writeOffCents(e: {
  amount_cents: number;
  is_write_off: 0 | 1 | boolean;
  write_off_pct: number;
}): number {
  if (!e.is_write_off) return 0;
  return Math.round((e.amount_cents * e.write_off_pct) / 100);
}
