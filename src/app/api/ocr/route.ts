import { NextRequest, NextResponse } from 'next/server';
import { OcrUnavailableError, runOcr } from '@/lib/ocr';
import { isPdf, pdfFirstPageToPng, PdfUnavailableError } from '@/lib/pdf';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('image');
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'No image provided.' }, { status: 400 });
    }
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 25 MB).' }, { status: 400 });
    }

    let buffer: Buffer = Buffer.from(await file.arrayBuffer());
    if (isPdf(file.name, file.type)) {
      buffer = await pdfFirstPageToPng(buffer, 300);
    }

    const result = await runOcr(buffer);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof OcrUnavailableError || err instanceof PdfUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error('POST /api/ocr failed:', err);
    return NextResponse.json({ error: 'OCR failed — you can still fill the form manually.' }, { status: 500 });
  }
}
