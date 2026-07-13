import { getDb } from './db';
import type { Expense, ExpenseRow, ExpenseStats } from './types';
import { writeOffCents } from './types';

export interface ExpenseFilters {
  from?: string; // "YYYY-MM-DD"
  to?: string; // "YYYY-MM-DD" inclusive
  category_id?: number;
  account_id?: number;
  group_id?: number;
  write_off?: 'yes' | 'no';
  q?: string;
}

function buildWhere(filters: ExpenseFilters): { where: string; params: Record<string, unknown> } {
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  if (filters.from) {
    conditions.push("e.occurred_at >= :from");
    params.from = `${filters.from} 00:00`;
  }
  if (filters.to) {
    conditions.push("e.occurred_at <= :to");
    params.to = `${filters.to} 23:59`;
  }
  if (filters.category_id) {
    conditions.push('e.category_id = :category_id');
    params.category_id = filters.category_id;
  }
  if (filters.account_id) {
    conditions.push('e.account_id = :account_id');
    params.account_id = filters.account_id;
  }
  if (filters.group_id) {
    conditions.push('EXISTS (SELECT 1 FROM expense_groups eg WHERE eg.expense_id = e.id AND eg.group_id = :group_id)');
    params.group_id = filters.group_id;
  }
  if (filters.write_off === 'yes') conditions.push('e.is_write_off = 1');
  if (filters.write_off === 'no') conditions.push('e.is_write_off = 0');
  if (filters.q) {
    conditions.push('(e.vendor LIKE :q OR e.note LIKE :q)');
    params.q = `%${filters.q}%`;
  }

  return { where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params };
}

export function listExpenses(filters: ExpenseFilters): { expenses: ExpenseRow[]; stats: ExpenseStats } {
  const db = getDb();
  const { where, params } = buildWhere(filters);

  const rows = db
    .prepare(
      `SELECT e.*,
              c.name AS category_name, c.color AS category_color, c.write_off AS category_write_off,
              a.name AS account_name
       FROM expenses e
       LEFT JOIN categories c ON c.id = e.category_id
       LEFT JOIN accounts a ON a.id = e.account_id
       ${where}
       ORDER BY e.occurred_at DESC, e.id DESC`
    )
    .all(params) as Omit<ExpenseRow, 'group_ids' | 'group_names'>[];

  const groupStmt = getDb().prepare(
    `SELECT g.id, g.name FROM expense_groups eg JOIN groups g ON g.id = eg.group_id WHERE eg.expense_id = ? ORDER BY g.name`
  );

  const expenses: ExpenseRow[] = rows.map((row) => {
    const groups = groupStmt.all(row.id) as Array<{ id: number; name: string }>;
    return { ...row, group_ids: groups.map((g) => g.id), group_names: groups.map((g) => g.name) };
  });

  const stats: ExpenseStats = {
    count: expenses.length,
    total_cents: expenses.reduce((sum, e) => sum + e.amount_cents, 0),
    write_off_cents: expenses.reduce((sum, e) => sum + writeOffCents(e), 0),
  };

  return { expenses, stats };
}

export function getExpense(id: number): ExpenseRow | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT e.*,
              c.name AS category_name, c.color AS category_color, c.write_off AS category_write_off,
              a.name AS account_name
       FROM expenses e
       LEFT JOIN categories c ON c.id = e.category_id
       LEFT JOIN accounts a ON a.id = e.account_id
       WHERE e.id = ?`
    )
    .get(id) as Omit<ExpenseRow, 'group_ids' | 'group_names'> | undefined;
  if (!row) return null;

  const groups = db
    .prepare(`SELECT g.id, g.name FROM expense_groups eg JOIN groups g ON g.id = eg.group_id WHERE eg.expense_id = ? ORDER BY g.name`)
    .all(id) as Array<{ id: number; name: string }>;

  return { ...row, group_ids: groups.map((g) => g.id), group_names: groups.map((g) => g.name) };
}

export interface ExpenseInput {
  amount_cents: number;
  occurred_at: string;
  vendor: string;
  note: string;
  category_id: number | null;
  account_id: number | null;
  is_write_off: 0 | 1;
  write_off_pct: number;
  group_ids: number[];
  receipt_path?: string | null;
  ocr_text?: string | null;
}

export function createExpense(input: ExpenseInput): Expense {
  const db = getDb();
  const tx = db.transaction((data: ExpenseInput) => {
    const result = db
      .prepare(
        `INSERT INTO expenses (amount_cents, occurred_at, vendor, note, category_id, account_id, is_write_off, write_off_pct, receipt_path, ocr_text)
         VALUES (:amount_cents, :occurred_at, :vendor, :note, :category_id, :account_id, :is_write_off, :write_off_pct, :receipt_path, :ocr_text)`
      )
      .run({
        ...data,
        receipt_path: data.receipt_path ?? null,
        ocr_text: data.ocr_text ?? null,
      });
    const id = Number(result.lastInsertRowid);
    setGroups(id, data.group_ids);
    return id;
  });

  const id = tx(input);
  return db.prepare('SELECT * FROM expenses WHERE id = ?').get(id) as Expense;
}

export function updateExpense(id: number, input: ExpenseInput): Expense | null {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id) as Expense | undefined;
  if (!existing) return null;

  const tx = db.transaction((data: ExpenseInput) => {
    db.prepare(
      `UPDATE expenses SET
         amount_cents = :amount_cents, occurred_at = :occurred_at, vendor = :vendor, note = :note,
         category_id = :category_id, account_id = :account_id,
         is_write_off = :is_write_off, write_off_pct = :write_off_pct,
         receipt_path = :receipt_path, ocr_text = :ocr_text,
         updated_at = datetime('now')
       WHERE id = :id`
    ).run({
      ...data,
      id,
      receipt_path: data.receipt_path ?? null,
      ocr_text: data.ocr_text ?? null,
    });
    setGroups(id, data.group_ids);
  });
  tx(input);

  return db.prepare('SELECT * FROM expenses WHERE id = ?').get(id) as Expense;
}

function setGroups(expenseId: number, groupIds: number[]): void {
  const db = getDb();
  db.prepare('DELETE FROM expense_groups WHERE expense_id = ?').run(expenseId);
  const ins = db.prepare('INSERT OR IGNORE INTO expense_groups (expense_id, group_id) VALUES (?, ?)');
  for (const gid of groupIds) ins.run(expenseId, gid);
}

export function deleteExpense(id: number): Expense | null {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id) as Expense | undefined;
  if (!existing) return null;
  db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
  return existing;
}
