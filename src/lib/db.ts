import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
export const RECEIPTS_DIR = path.join(DATA_DIR, 'receipts');
const DB_DIR = path.join(DATA_DIR, 'db');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL DEFAULT 'card',
  archived INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  write_off TEXT NOT NULL DEFAULT 'full' CHECK (write_off IN ('full', 'partial', 'none')),
  default_write_off_pct INTEGER NOT NULL DEFAULT 100 CHECK (default_write_off_pct BETWEEN 0 AND 100),
  color TEXT NOT NULL DEFAULT '#71717a',
  archived INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL DEFAULT 'project' CHECK (kind IN ('project', 'client', 'trip', 'other')),
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  occurred_at TEXT NOT NULL,
  vendor TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  is_write_off INTEGER NOT NULL DEFAULT 0,
  write_off_pct INTEGER NOT NULL DEFAULT 0 CHECK (write_off_pct BETWEEN 0 AND 100),
  receipt_path TEXT,
  ocr_text TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS expense_groups (
  expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  PRIMARY KEY (expense_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_expenses_occurred_at ON expenses(occurred_at);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_account ON expenses(account_id);
CREATE INDEX IF NOT EXISTS idx_expense_groups_group ON expense_groups(group_id);
`;

// Categories tailored to a field IT services business.
const SEED_CATEGORIES: Array<[string, 'full' | 'partial' | 'none', number, string]> = [
  ['Tools & Equipment', 'full', 100, '#0ea5e9'],
  ['Computer Hardware & Parts', 'full', 100, '#6366f1'],
  ['Cables & Consumables', 'full', 100, '#8b5cf6'],
  ['Software & Licenses', 'full', 100, '#a855f7'],
  ['Fuel', 'partial', 80, '#f59e0b'],
  ['Vehicle Maintenance & Repairs', 'partial', 80, '#d97706'],
  ['Parking & Tolls', 'full', 100, '#eab308'],
  ['Travel & Lodging', 'full', 100, '#14b8a6'],
  ['Meals & Client Entertainment', 'partial', 50, '#f43f5e'],
  ['Mobile & Internet', 'partial', 50, '#06b6d4'],
  ['Office Supplies', 'full', 100, '#84cc16'],
  ['Shipping & Postage', 'full', 100, '#10b981'],
  ['Training & Certifications', 'full', 100, '#3b82f6'],
  ['Subcontractors', 'full', 100, '#ec4899'],
  ['Marketing & Advertising', 'full', 100, '#f97316'],
  ['Insurance', 'full', 100, '#64748b'],
  ['Safety Gear & Uniforms', 'full', 100, '#22c55e'],
  ['Bank & Payment Fees', 'full', 100, '#94a3b8'],
  ['Workspace / Home Office', 'partial', 30, '#78716c'],
  ['Personal / Non-deductible', 'none', 0, '#71717a'],
  ['Miscellaneous', 'full', 100, '#a1a1aa'],
];

const SEED_ACCOUNTS: Array<[string, string]> = [
  ['Business Debit Card', 'card'],
  ['Business Credit Card', 'card'],
  ['Cash', 'cash'],
  ['Bank Transfer', 'bank'],
];

function createDb(): Database.Database {
  fs.mkdirSync(DB_DIR, { recursive: true });
  fs.mkdirSync(RECEIPTS_DIR, { recursive: true });

  const db = new Database(path.join(DB_DIR, 'expenses.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);

  const categoryCount = (db.prepare('SELECT COUNT(*) AS n FROM categories').get() as { n: number }).n;
  if (categoryCount === 0) {
    const ins = db.prepare(
      'INSERT INTO categories (name, write_off, default_write_off_pct, color) VALUES (?, ?, ?, ?)'
    );
    for (const row of SEED_CATEGORIES) ins.run(...row);
  }

  const accountCount = (db.prepare('SELECT COUNT(*) AS n FROM accounts').get() as { n: number }).n;
  if (accountCount === 0) {
    const ins = db.prepare('INSERT INTO accounts (name, kind) VALUES (?, ?)');
    for (const row of SEED_ACCOUNTS) ins.run(...row);
  }

  return db;
}

// Reuse the connection across Next.js dev-mode module reloads.
const globalForDb = globalThis as unknown as { __expensesDb?: Database.Database };

export function getDb(): Database.Database {
  if (!globalForDb.__expensesDb) {
    globalForDb.__expensesDb = createDb();
  }
  return globalForDb.__expensesDb;
}
