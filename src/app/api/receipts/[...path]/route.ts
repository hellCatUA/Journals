import fs from 'fs';
import { NextRequest, NextResponse } from 'next/server';
import { pdfFirstPageToPng, PdfUnavailableError } from '@/lib/pdf';
import { receiptContentType, resolveReceiptPath } from '@/lib/receipts';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, { params }: Params) {
  const relPath = (await params).path.join('/');
  const abs = resolveReceiptPath(relPath);
  if (!abs || !fs.existsSync(abs)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const data = fs.readFileSync(abs);

  // ?preview=1 on a PDF returns its first page rendered as PNG,
  // so the UI can show PDF receipts like regular photos.
  const wantsPreview = req.nextUrl.searchParams.get('preview') === '1';
  if (wantsPreview && relPath.toLowerCase().endsWith('.pdf')) {
    try {
      const png = await pdfFirstPageToPng(data, 150);
      return new NextResponse(new Uint8Array(png), {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'private, max-age=86400',
        },
      });
    } catch (err) {
      const status = err instanceof PdfUnavailableError ? 501 : 500;
      console.error(`PDF preview failed for ${relPath}:`, err);
      return NextResponse.json({ error: 'PDF preview unavailable.' }, { status });
    }
  }

  return new NextResponse(new Uint8Array(data), {
    headers: {
      'Content-Type': receiptContentType(relPath),
      'Cache-Control': 'private, max-age=86400',
    },
  });
}
