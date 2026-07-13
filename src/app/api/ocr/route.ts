import { NextRequest, NextResponse } from 'next/server';
import { OcrUnavailableError, runOcr } from '@/lib/ocr';

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
      return NextResponse.json({ error: 'Image too large (max 25 MB).' }, { status: 400 });
    }
    if (file.type === 'application/pdf') {
      return NextResponse.json(
        { error: 'OCR works on photos only — enter PDF receipts manually.' },
        { status: 415 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await runOcr(buffer);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof OcrUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error('POST /api/ocr failed:', err);
    return NextResponse.json({ error: 'OCR failed — you can still fill the form manually.' }, { status: 500 });
  }
}
