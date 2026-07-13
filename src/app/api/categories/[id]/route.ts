import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import type { Category, WriteOffPolicy } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const id = Number.parseInt((await params).id, 10);
  const db = getDb();
  const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as Category | undefined;
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? existing.name).trim() || existing.name;
  const write_off: WriteOffPolicy = ['full', 'partial', 'none'].includes(body?.write_off)
    ? body.write_off
    : existing.write_off;
  const pct =
    write_off === 'none' ? 0 : write_off === 'full' ? 100 : clamp(body?.default_write_off_pct, existing.default_write_off_pct);
  const color = /^#[0-9a-fA-F]{6}$/.test(String(body?.color ?? '')) ? body.color : existing.color;
  const archived = body?.archived === undefined ? existing.archived : body.archived ? 1 : 0;
  let icon = existing.icon;
  if (body?.icon !== undefined) {
    const s = String(body.icon ?? '').trim();
    icon = /^[a-z0-9-]{1,60}$/.test(s) ? s : '';
  }

  try {
    db.prepare(
      'UPDATE categories SET name = ?, write_off = ?, default_write_off_pct = ?, color = ?, icon = ?, archived = ? WHERE id = ?'
    ).run(name, write_off, pct, color, icon, archived, id);
  } catch {
    return NextResponse.json({ error: 'A category with this name already exists.' }, { status: 409 });
  }

  return NextResponse.json({ category: db.prepare('SELECT * FROM categories WHERE id = ?').get(id) });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const id = Number.parseInt((await params).id, 10);
  const db = getDb();
  const inUse = (db.prepare('SELECT COUNT(*) AS n FROM expenses WHERE category_id = ?').get(id) as { n: number }).n;
  if (inUse > 0) {
    return NextResponse.json(
      { error: `Category is used by ${inUse} expense(s). Archive it instead.` },
      { status: 409 }
    );
  }
  const result = db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  if (result.changes === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

function clamp(value: unknown, fallback: number): number {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(n) ? Math.min(100, Math.max(1, n)) : fallback;
}
