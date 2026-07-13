import { Suspense } from 'react';
import GroupsView from '@/components/GroupsView';

export const metadata = { title: 'Groups · Field Expenses' };

export default function GroupsPage() {
  return (
    <Suspense>
      <GroupsView />
    </Suspense>
  );
}
