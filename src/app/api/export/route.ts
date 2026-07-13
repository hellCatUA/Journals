import { NextRequest, NextResponse } from 'next/server';
import { expensesToCsv } from '@/lib/csv';
import { listExpenses, type ExpenseFilters } from '@/lib/expenses';

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

  const { expenses } = listExpenses(filters);
  const csv = expensesToCsv(expenses);

  const rangePart = [filters.from, filters.to].filter(Boolean).join('_to_') || 'all';
  const filename = `expenses_${rangePart}.csv`;

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

function idParam(value: string | null): number | undefined {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}
