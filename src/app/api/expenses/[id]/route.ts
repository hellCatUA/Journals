import { NextRequest, NextResponse } from 'next/server';
import {
  addAttachment,
  deleteExpense,
  getAttachments,
  getExpense,
  removeAttachments,
  updateAttachmentPath,
  updateExpense,
} from '@/lib/expenses';
import { deleteReceipt, moveReceipt, saveReceipt } from '@/lib/receipts';
import { evidenceFilesFromForm, expenseInputFromForm, MAX_FILE_BYTES, ValidationError } from '@/lib/validate';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const id = Number.parseInt((await params).id, 10);
  const expense = getExpense(id);
  if (!expense) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ expense });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const id = Number.parseInt((await params).id, 10);
  const existing = getExpense(id);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const form = await req.formData();
    const input = expenseInputFromForm(form);
    const newEvidence = evidenceFilesFromForm(form);

    let receiptPath = existing.receipt_path;
    const newReceipt = form.get('receipt');
    const removeReceipt = form.get('remove_receipt') === '1';

    if (newReceipt instanceof File && newReceipt.size > 0) {
      if (newReceipt.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: 'Receipt file too large (max 25 MB).' }, { status: 400 });
      }
      if (receiptPath) deleteReceipt(receiptPath);
      receiptPath = await saveReceipt(newReceipt, input.occurred_at);
    } else if (removeReceipt && receiptPath) {
      deleteReceipt(receiptPath);
      receiptPath = null;
    } else if (receiptPath && input.occurred_at !== existing.occurred_at) {
      receiptPath = moveReceipt(receiptPath, input.occurred_at);
    }

    // Supporting evidence: drop the ones marked for removal, add new ones.
    const removeIds = String(form.get('remove_attachment_ids') ?? '')
      .split(',')
      .map((s) => Number.parseInt(s.trim(), 10))
      .filter((n) => Number.isInteger(n) && n > 0);
    for (const path of removeAttachments(id, removeIds)) deleteReceipt(path);

    for (const f of newEvidence) {
      const path = await saveReceipt(f, input.occurred_at);
      addAttachment(id, path, f.name);
    }

    // Keep the YY/MM/DD layout truthful for remaining evidence when the date changed.
    if (input.occurred_at !== existing.occurred_at) {
      for (const att of getAttachments(id)) {
        const moved = moveReceipt(att.path, input.occurred_at);
        if (moved !== att.path) updateAttachmentPath(att.id, moved);
      }
    }

    input.receipt_path = receiptPath;
    if (input.ocr_text === null) input.ocr_text = existing.ocr_text;

    updateExpense(id, input);
    return NextResponse.json({ expense: getExpense(id) });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(`PUT /api/expenses/${id} failed:`, err);
    return NextResponse.json({ error: 'Failed to update expense.' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const id = Number.parseInt((await params).id, 10);
  const deleted = deleteExpense(id);
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (deleted.expense.receipt_path) deleteReceipt(deleted.expense.receipt_path);
  for (const path of deleted.attachment_paths) deleteReceipt(path);
  return NextResponse.json({ ok: true });
}
