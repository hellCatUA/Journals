import { NextRequest, NextResponse } from 'next/server';
import { deleteExpense, getExpense, updateExpense } from '@/lib/expenses';
import { deleteReceipt, moveReceipt, saveReceipt } from '@/lib/receipts';
import { expenseInputFromForm, ValidationError } from '@/lib/validate';

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

    let receiptPath = existing.receipt_path;
    const newReceipt = form.get('receipt');
    const removeReceipt = form.get('remove_receipt') === '1';

    if (newReceipt instanceof File && newReceipt.size > 0) {
      if (newReceipt.size > 25 * 1024 * 1024) {
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

    input.receipt_path = receiptPath;
    if (input.ocr_text === null) input.ocr_text = existing.ocr_text;

    const expense = updateExpense(id, input);
    return NextResponse.json({ expense });
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
  if (deleted.receipt_path) deleteReceipt(deleted.receipt_path);
  return NextResponse.json({ ok: true });
}
