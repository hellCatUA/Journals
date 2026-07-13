import ExpenseForm from '@/components/ExpenseForm';

export const metadata = { title: 'Add expense · Field Expenses' };

export default function AddExpensePage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Add expense</h1>
      <ExpenseForm />
    </div>
  );
}
