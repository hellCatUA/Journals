import { notFound } from 'next/navigation';
import ExpenseForm from '@/components/ExpenseForm';
import DeleteExpenseButton from '@/components/DeleteExpenseButton';
import { getExpense } from '@/lib/expenses';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Edit expense · Journals' };

export default async function EditExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number.parseInt((await params).id, 10);
  const expense = Number.isInteger(id) ? getExpense(id) : null;
  if (!expense) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Edit expense</h1>
        <DeleteExpenseButton id={expense.id} />
      </div>
      <ExpenseForm expense={expense} />
    </div>
  );
}
