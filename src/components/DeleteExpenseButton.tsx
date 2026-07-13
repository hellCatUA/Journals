'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function DeleteExpenseButton({ id }: { id: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (!confirm('Delete this expense and its receipt photo?')) return;
    setBusy(true);
    const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
    if (res.ok) {
      router.push('/');
      router.refresh();
    } else {
      setBusy(false);
      alert('Delete failed.');
    }
  }

  return (
    <button className="btn-danger" onClick={onDelete} disabled={busy}>
      {busy ? 'Deleting…' : 'Delete'}
    </button>
  );
}
