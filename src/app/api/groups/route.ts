import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import type { GroupWithStats } from '@/lib/types';

export const dynamic = 'force-dynamic';

const KINDS = ['project', 'client', 'trip', 'other'];

export async function GET() {
  const groups = getDb()
    .prepare(
      `SELECT g.*,
              COUNT(eg.expense_id) AS expense_count,
              COALESCE(SUM(e.amount_cents), 0) AS total_cents,
              COALESCE(SUM(CASE WHEN e.is_write_off = 1 THEN CAST(ROUND(e.amount_cents * e.write_off_pct / 100.0) AS INTEGER) ELSE 0 END), 0) AS write_off_cents
       FROM groups g
       LEFT JOIN expense_groups eg ON eg.group_id = g.id
       LEFT JOIN expenses e ON e.id = eg.expense_id
       GROUP BY g.id
       ORDER BY g.kind, g.name`
    )
    .all() as GroupWithStats[];
  return NextResponse.json({ groups });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? '').trim();
  if (!name) return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
  const kind = KINDS.includes(body?.kind) ? body.kind : 'project';
  const note = String(body?.note ?? '').trim().slice(0, 500);

  try {
    const result = getDb().prepare('INSERT INTO groups (name, kind, note) VALUES (?, ?, ?)').run(name, kind, note);
    const group = getDb().prepare('SELECT * FROM groups WHERE id = ?').get(result.lastInsertRowid);
    return NextResponse.json({ group }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'A group with this name already exists.' }, { status: 409 });
  }
}
