import fs from 'fs';
import { NextRequest, NextResponse } from 'next/server';
import { receiptContentType, resolveReceiptPath } from '@/lib/receipts';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ path: string[] }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const relPath = (await params).path.join('/');
  const abs = resolveReceiptPath(relPath);
  if (!abs || !fs.existsSync(abs)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const data = fs.readFileSync(abs);
  return new NextResponse(new Uint8Array(data), {
    headers: {
      'Content-Type': receiptContentType(relPath),
      'Cache-Control': 'private, max-age=86400',
    },
  });
}
