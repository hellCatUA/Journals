import { Suspense } from 'react';
import SettingsView from '@/components/SettingsView';

export const metadata = { title: 'Settings · Journals' };

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsView />
    </Suspense>
  );
}
