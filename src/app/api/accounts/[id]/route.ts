import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import type { Account } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

const KINDS = ['card', 'cash', 'bank', 'other'];

export async function PUT(req: NextRequest, { params }: Params) {
  const id = Number.parseInt((await params).id, 10);
  const db = getDb();
  const existing = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as Account | undefined;
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? existing.name).trim() || existing.name;
  const kind = KINDS.includes(body?.kind) ? body.kind : existing.kind;
  const archived = body?.archived === undefined ? existing.archived : body.archived ? 1 : 0;

  try {
    db.prepare('UPDATE accounts SET name = ?, kind = ?, archived = ? WHERE id = ?').run(name, kind, archived, id);
  } catch {
    return NextResponse.json({ error: 'An account with this name already exists.' }, { status: 409 });
  }

  return NextResponse.json({ account: db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const id = Number.parseInt((await params).id, 10);
  const db = getDb();
  const inUse = (db.prepare('SELECT COUNT(*) AS n FROM expenses WHERE account_id = ?').get(id) as { n: number }).n;
  if (inUse > 0) {
    return NextResponse.json(
      { error: `Account is used by ${inUse} expense(s). Archive it instead.` },
      { status: 409 }
    );
  }
  const result = db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
  if (result.changes === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
