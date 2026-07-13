import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    getDb().prepare('SELECT 1').get();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Health check failed:', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
