import { Suspense } from 'react';
import ExpensesView from '@/components/ExpensesView';

export default function HomePage() {
  return (
    <Suspense>
      <ExpensesView />
    </Suspense>
  );
}
