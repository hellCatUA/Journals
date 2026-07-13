import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import type { Group } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

const KINDS = ['project', 'client', 'trip', 'other'];

export async function PUT(req: NextRequest, { params }: Params) {
  const id = Number.parseInt((await params).id, 10);
  const db = getDb();
  const existing = db.prepare('SELECT * FROM groups WHERE id = ?').get(id) as Group | undefined;
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? existing.name).trim() || existing.name;
  const kind = KINDS.includes(body?.kind) ? body.kind : existing.kind;
  const note = body?.note === undefined ? existing.note : String(body.note).trim().slice(0, 500);

  try {
    db.prepare('UPDATE groups SET name = ?, kind = ?, note = ? WHERE id = ?').run(name, kind, note, id);
  } catch {
    return NextResponse.json({ error: 'A group with this name already exists.' }, { status: 409 });
  }

  return NextResponse.json({ group: db.prepare('SELECT * FROM groups WHERE id = ?').get(id) });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const id = Number.parseInt((await params).id, 10);
  // Deleting a group only unlinks it from expenses (ON DELETE CASCADE on the join table).
  const result = getDb().prepare('DELETE FROM groups WHERE id = ?').run(id);
  if (result.changes === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
