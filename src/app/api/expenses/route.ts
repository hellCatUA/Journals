import { NextRequest, NextResponse } from 'next/server';
import { addAttachment, createExpense, listExpenses, type ExpenseFilters } from '@/lib/expenses';
import { saveReceipt } from '@/lib/receipts';
import { evidenceFilesFromForm, expenseInputFromForm, MAX_FILE_BYTES, ValidationError } from '@/lib/validate';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const filters: ExpenseFilters = {
    from: sp.get('from') || undefined,
    to: sp.get('to') || undefined,
    category_id: idParam(sp.get('category_id')),
    account_id: idParam(sp.get('account_id')),
    group_id: idParam(sp.get('group_id')),
    write_off: (sp.get('write_off') as 'yes' | 'no') || undefined,
    q: sp.get('q') || undefined,
  };
  return NextResponse.json(listExpenses(filters));
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const input = expenseInputFromForm(form);
    const evidence = evidenceFilesFromForm(form);

    const receipt = form.get('receipt');
    if (receipt instanceof File && receipt.size > 0) {
      if (receipt.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: 'Receipt file too large (max 25 MB).' }, { status: 400 });
      }
      input.receipt_path = await saveReceipt(receipt, input.occurred_at);
    }

    const expense = createExpense(input);
    for (const f of evidence) {
      const path = await saveReceipt(f, input.occurred_at);
      addAttachment(expense.id, path, f.name);
    }
    return NextResponse.json({ expense }, { status: 201 });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error('POST /api/expenses failed:', err);
    return NextResponse.json({ error: 'Failed to create expense.' }, { status: 500 });
  }
}

function idParam(value: string | null): number | undefined {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}
