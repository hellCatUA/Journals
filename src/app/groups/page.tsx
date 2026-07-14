import { Suspense } from 'react';
import GroupsView from '@/components/GroupsView';

export const metadata = { title: 'Groups · Journals' };

export default function GroupsPage() {
  return (
    <Suspense>
      <GroupsView />
    </Suspense>
  );
}
