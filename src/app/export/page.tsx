import { Suspense } from 'react';
import ExportView from '@/components/ExportView';

export const metadata = { title: 'Export · Journals' };

export default function ExportPage() {
  return (
    <Suspense>
      <ExportView />
    </Suspense>
  );
}
