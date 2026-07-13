import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import type { WriteOffPolicy } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const includeArchived = req.nextUrl.searchParams.get('all') === '1';
  const db = getDb();
  const categories = db
    .prepare(`SELECT * FROM categories ${includeArchived ? '' : 'WHERE archived = 0'} ORDER BY name`)
    .all();
  return NextResponse.json({ categories });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? '').trim();
  if (!name) return NextResponse.json({ error: 'Name is required.' }, { status: 400 });

  const write_off: WriteOffPolicy = ['full', 'partial', 'none'].includes(body?.write_off)
    ? body.write_off
    : 'full';
  const pct = clampPct(body?.default_write_off_pct, write_off);
  const color = /^#[0-9a-fA-F]{6}$/.test(String(body?.color ?? '')) ? body.color : '#71717a';
  const icon = sanitizeIcon(body?.icon);

  try {
    const result = getDb()
      .prepare('INSERT INTO categories (name, write_off, default_write_off_pct, color, icon) VALUES (?, ?, ?, ?, ?)')
      .run(name, write_off, pct, color, icon);
    const category = getDb().prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
    return NextResponse.json({ category }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'A category with this name already exists.' }, { status: 409 });
  }
}

function clampPct(value: unknown, policy: WriteOffPolicy): number {
  if (policy === 'none') return 0;
  if (policy === 'full') return 100;
  const n = Number.parseInt(String(value ?? '50'), 10);
  return Number.isInteger(n) ? Math.min(100, Math.max(1, n)) : 50;
}

function sanitizeIcon(value: unknown): string {
  const s = String(value ?? '').trim();
  return /^[a-z0-9-]{1,60}$/.test(s) ? s : '';
}
