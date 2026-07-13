import { NextRequest, NextResponse } from 'next/server';
import { suggestVendors } from '@/lib/expenses';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') ?? '';
  return NextResponse.json({ suggestions: suggestVendors(q.slice(0, 100)) });
}
