import { Suspense } from 'react';
import ExportView from '@/components/ExportView';

export const metadata = { title: 'Export · Field Expenses' };

export default function ExportPage() {
  return (
    <Suspense>
      <ExportView />
    </Suspense>
  );
}
