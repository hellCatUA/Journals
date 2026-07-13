import { getDb } from './db';
import type { Attachment, Expense, ExpenseDetail, ExpenseRow, ExpenseStats, VendorSuggestion } from './types';
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
              c.name AS category_name, c.color AS category_color, c.icon AS category_icon, c.write_off AS category_write_off,
              a.name AS account_name,
              (SELECT GROUP_CONCAT(att.path, '; ') FROM attachments att WHERE att.expense_id = e.id) AS evidence_paths
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

export function getExpense(id: number): ExpenseDetail | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT e.*,
              c.name AS category_name, c.color AS category_color, c.icon AS category_icon, c.write_off AS category_write_off,
              a.name AS account_name,
              (SELECT GROUP_CONCAT(att.path, '; ') FROM attachments att WHERE att.expense_id = e.id) AS evidence_paths
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

  return {
    ...row,
    group_ids: groups.map((g) => g.id),
    group_names: groups.map((g) => g.name),
    attachments: getAttachments(id),
  };
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

export function deleteExpense(id: number): { expense: Expense; attachment_paths: string[] } | null {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id) as Expense | undefined;
  if (!existing) return null;
  const attachmentPaths = (
    db.prepare('SELECT path FROM attachments WHERE expense_id = ?').all(id) as Array<{ path: string }>
  ).map((a) => a.path);
  db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
  return { expense: existing, attachment_paths: attachmentPaths };
}

/* ---------------- Supporting evidence attachments ---------------- */

export function getAttachments(expenseId: number): Attachment[] {
  return getDb()
    .prepare('SELECT * FROM attachments WHERE expense_id = ? ORDER BY id')
    .all(expenseId) as Attachment[];
}

export function addAttachment(expenseId: number, path: string, originalName: string): Attachment {
  const db = getDb();
  const result = db
    .prepare('INSERT INTO attachments (expense_id, path, original_name) VALUES (?, ?, ?)')
    .run(expenseId, path, originalName.slice(0, 200));
  return db.prepare('SELECT * FROM attachments WHERE id = ?').get(result.lastInsertRowid) as Attachment;
}

/** Remove attachment rows belonging to the expense; returns the file paths that were removed. */
export function removeAttachments(expenseId: number, ids: number[]): string[] {
  if (ids.length === 0) return [];
  const db = getDb();
  const placeholders = ids.map(() => '?').join(',');
  const rows = db
    .prepare(`SELECT id, path FROM attachments WHERE expense_id = ? AND id IN (${placeholders})`)
    .all(expenseId, ...ids) as Array<{ id: number; path: string }>;
  db.prepare(`DELETE FROM attachments WHERE expense_id = ? AND id IN (${placeholders})`).run(expenseId, ...ids);
  return rows.map((r) => r.path);
}

export function updateAttachmentPath(id: number, path: string): void {
  getDb().prepare('UPDATE attachments SET path = ? WHERE id = ?').run(path, id);
}

/* ---------------- Vendor suggestions ---------------- */

function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/**
 * Suggest vendors from expense history, most-used first (prefix matches
 * ranked above substring matches). Each suggestion carries the vendor's
 * most frequent category and account so the form can prefill them.
 */
export function suggestVendors(q: string, limit = 8): VendorSuggestion[] {
  const db = getDb();
  const escaped = escapeLike(q.trim());

  const rows = db
    .prepare(
      `SELECT vendor, COUNT(*) AS uses, MAX(occurred_at) AS last_used
       FROM expenses
       WHERE vendor <> '' AND vendor LIKE :pattern ESCAPE '\\'
       GROUP BY vendor COLLATE NOCASE
       ORDER BY (CASE WHEN vendor LIKE :prefix ESCAPE '\\' THEN 0 ELSE 1 END), uses DESC, last_used DESC
       LIMIT :limit`
    )
    .all({ pattern: `%${escaped}%`, prefix: `${escaped}%`, limit }) as Array<{ vendor: string; uses: number }>;

  const topCategory = db.prepare(
    `SELECT e.category_id AS id, c.name AS name
     FROM expenses e JOIN categories c ON c.id = e.category_id
     WHERE e.vendor = ? COLLATE NOCASE AND e.category_id IS NOT NULL
     GROUP BY e.category_id ORDER BY COUNT(*) DESC, MAX(e.occurred_at) DESC LIMIT 1`
  );
  const topAccount = db.prepare(
    `SELECT account_id AS id FROM expenses
     WHERE vendor = ? COLLATE NOCASE AND account_id IS NOT NULL
     GROUP BY account_id ORDER BY COUNT(*) DESC, MAX(occurred_at) DESC LIMIT 1`
  );

  return rows.map((r) => {
    const cat = topCategory.get(r.vendor) as { id: number; name: string } | undefined;
    const acc = topAccount.get(r.vendor) as { id: number } | undefined;
    return {
      vendor: r.vendor,
      uses: r.uses,
      category_id: cat?.id ?? null,
      category_name: cat?.name ?? null,
      account_id: acc?.id ?? null,
    };
  });
}
