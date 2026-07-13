import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

const KINDS = ['card', 'cash', 'bank', 'other'];

export async function GET(req: NextRequest) {
  const includeArchived = req.nextUrl.searchParams.get('all') === '1';
  const accounts = getDb()
    .prepare(`SELECT * FROM accounts ${includeArchived ? '' : 'WHERE archived = 0'} ORDER BY name`)
    .all();
  return NextResponse.json({ accounts });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? '').trim();
  if (!name) return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
  const kind = KINDS.includes(body?.kind) ? body.kind : 'card';

  try {
    const result = getDb().prepare('INSERT INTO accounts (name, kind) VALUES (?, ?)').run(name, kind);
    const account = getDb().prepare('SELECT * FROM accounts WHERE id = ?').get(result.lastInsertRowid);
    return NextResponse.json({ account }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'An account with this name already exists.' }, { status: 409 });
  }
}
