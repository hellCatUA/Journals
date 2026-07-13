'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { GroupWithStats } from '@/lib/types';
import { formatMoney } from '@/lib/format';

const KIND_LABELS: Record<string, string> = {
  project: 'Project',
  client: 'Client',
  trip: 'Trip',
  other: 'Other',
};

export default function GroupsView() {
  const [groups, setGroups] = useState<GroupWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [kind, setKind] = useState('project');
  const [note, setNote] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    fetch('/api/groups')
      .then((r) => r.json())
      .then((data) => setGroups(data.groups))
      .catch(() => setError('Failed to load groups.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, kind, note }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to create group.');
        return;
      }
      setName('');
      setNote('');
      load();
    } finally {
      setCreating(false);
    }
  }

  async function renameGroup(g: GroupWithStats) {
    const newName = prompt('Group name:', g.name);
    if (!newName || newName === g.name) return;
    const res = await fetch(`/api/groups/${g.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    });
    if (!res.ok) alert((await res.json()).error ?? 'Rename failed.');
    load();
  }

  async function deleteGroup(g: GroupWithStats) {
    if (!confirm(`Delete group "${g.name}"? Expenses stay, they are just untagged.`)) return;
    await fetch(`/api/groups/${g.id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Groups</h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Group expenses by project, client or trip. An expense can belong to several groups at once.
      </p>

      <form onSubmit={createGroup} className="card grid gap-2 p-3 sm:grid-cols-[2fr_1fr_2fr_auto]">
        <input className="input" placeholder="Group name (e.g. Server room build-out)" value={name} onChange={(e) => setName(e.target.value)} required />
        <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
          {Object.entries(KIND_LABELS).map(([k, label]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </select>
        <input className="input" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="btn-primary" disabled={creating}>Create</button>
      </form>

      {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        {loading ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
        ) : groups.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No groups yet.</p>
        ) : (
          groups.map((g) => (
            <div key={g.id} className="card flex flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{g.name}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {KIND_LABELS[g.kind] ?? g.kind}
                    {g.note ? ` · ${g.note}` : ''}
                  </p>
                </div>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {g.expense_count} exp.
                </span>
              </div>

              <div className="flex items-baseline gap-3">
                <span className="text-xl font-semibold">{formatMoney(g.total_cents)}</span>
                <span className="text-xs text-emerald-600 dark:text-emerald-400">
                  {formatMoney(g.write_off_cents)} write-off
                </span>
              </div>

              <div className="mt-1 flex gap-2">
                <Link href={`/?group_id=${g.id}`} className="btn-secondary flex-1 text-center">View expenses</Link>
                <button className="btn-secondary" onClick={() => renameGroup(g)}>Rename</button>
                <button className="btn-danger" onClick={() => deleteGroup(g)}>Delete</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
