import { Suspense } from 'react';
import SettingsView from '@/components/SettingsView';

export const metadata = { title: 'Settings · Field Expenses' };

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsView />
    </Suspense>
  );
}
