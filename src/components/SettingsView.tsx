'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Account, Category, WriteOffPolicy } from '@/lib/types';

export default function SettingsView() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">Settings</h1>
      <AccountsSection />
      <CategoriesSection />
    </div>
  );
}

/* ---------------- Accounts ---------------- */

const ACCOUNT_KINDS = [
  { id: 'card', label: 'Card' },
  { id: 'cash', label: 'Cash' },
  { id: 'bank', label: 'Bank' },
  { id: 'other', label: 'Other' },
];

function AccountsSection() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [name, setName] = useState('');
  const [kind, setKind] = useState('card');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch('/api/accounts?all=1')
      .then((r) => r.json())
      .then((data) => setAccounts(data.accounts));
  }, []);

  useEffect(load, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, kind }),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? 'Failed.');
      return;
    }
    setName('');
    load();
  }

  async function update(a: Account, patch: Partial<Account>) {
    setError(null);
    const res = await fetch(`/api/accounts/${a.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) setError((await res.json()).error ?? 'Failed.');
    load();
  }

  async function remove(a: Account) {
    if (!confirm(`Delete account "${a.name}"?`)) return;
    setError(null);
    const res = await fetch(`/api/accounts/${a.id}`, { method: 'DELETE' });
    if (!res.ok) setError((await res.json()).error ?? 'Failed.');
    load();
  }

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="font-semibold">Accounts</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Where the money comes from: cards, cash, bank.</p>
      </div>

      <form onSubmit={add} className="card grid grid-cols-[2fr_1fr_auto] gap-2 p-3">
        <input className="input" placeholder="Account name" value={name} onChange={(e) => setName(e.target.value)} required />
        <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
          {ACCOUNT_KINDS.map((k) => (
            <option key={k.id} value={k.id}>{k.label}</option>
          ))}
        </select>
        <button className="btn-primary">Add</button>
      </form>

      {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="card divide-y divide-zinc-100 dark:divide-zinc-800">
        {accounts.map((a) => (
          <div key={a.id} className={`flex items-center gap-3 p-3 ${a.archived ? 'opacity-50' : ''}`}>
            <span className="flex-1 text-sm font-medium">{a.name}</span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{a.kind}</span>
            <button
              className="btn-secondary px-2 py-1 text-xs"
              onClick={() => {
                const newName = prompt('Account name:', a.name);
                if (newName && newName !== a.name) update(a, { name: newName } as Partial<Account>);
              }}
            >
              Rename
            </button>
            <button className="btn-secondary px-2 py-1 text-xs" onClick={() => update(a, { archived: a.archived ? 0 : 1 })}>
              {a.archived ? 'Unarchive' : 'Archive'}
            </button>
            <button className="btn-danger px-2 py-1 text-xs" onClick={() => remove(a)}>Delete</button>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Categories ---------------- */

const POLICIES: Array<{ id: WriteOffPolicy; label: string }> = [
  { id: 'full', label: 'Full write-off' },
  { id: 'partial', label: 'Partial only' },
  { id: 'none', label: 'Non-deductible' },
];

function CategoriesSection() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [policy, setPolicy] = useState<WriteOffPolicy>('full');
  const [pct, setPct] = useState('50');
  const [color, setColor] = useState('#0ea5e9');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch('/api/categories?all=1')
      .then((r) => r.json())
      .then((data) => setCategories(data.categories));
  }, []);

  useEffect(load, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, write_off: policy, default_write_off_pct: Number(pct), color }),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? 'Failed.');
      return;
    }
    setName('');
    load();
  }

  async function update(c: Category, patch: Record<string, unknown>) {
    setError(null);
    const res = await fetch(`/api/categories/${c.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) setError((await res.json()).error ?? 'Failed.');
    load();
  }

  async function remove(c: Category) {
    if (!confirm(`Delete category "${c.name}"?`)) return;
    setError(null);
    const res = await fetch(`/api/categories/${c.id}`, { method: 'DELETE' });
    if (!res.ok) setError((await res.json()).error ?? 'Failed.');
    load();
  }

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="font-semibold">Expense categories</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Write-off policy controls the default on new expenses: full (100%), partial (custom %) or non-deductible.
        </p>
      </div>

      <form onSubmit={add} className="card grid grid-cols-2 gap-2 p-3 sm:grid-cols-[2fr_1fr_5rem_3rem_auto]">
        <input className="input" placeholder="Category name" value={name} onChange={(e) => setName(e.target.value)} required />
        <select className="input" value={policy} onChange={(e) => setPolicy(e.target.value as WriteOffPolicy)}>
          {POLICIES.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
        <input
          className="input text-center"
          inputMode="numeric"
          title="Default write-off %"
          value={policy === 'partial' ? pct : policy === 'full' ? '100' : '0'}
          disabled={policy !== 'partial'}
          onChange={(e) => setPct(e.target.value)}
        />
        <input type="color" className="h-9 w-full cursor-pointer rounded-lg border border-zinc-300 bg-transparent dark:border-zinc-700" value={color} onChange={(e) => setColor(e.target.value)} title="Color" />
        <button className="btn-primary">Add</button>
      </form>

      {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="card divide-y divide-zinc-100 dark:divide-zinc-800">
        {categories.map((c) => (
          <div key={c.id} className={`flex flex-wrap items-center gap-2 p-3 sm:flex-nowrap ${c.archived ? 'opacity-50' : ''}`}>
            <span className="h-3 w-3 flex-none rounded-full" style={{ backgroundColor: c.color }} />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>

            <select
              className="input w-auto py-1 text-xs"
              value={c.write_off}
              onChange={(e) => update(c, { write_off: e.target.value })}
            >
              {POLICIES.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>

            {c.write_off === 'partial' && (
              <input
                className="input w-16 py-1 text-center text-xs"
                inputMode="numeric"
                defaultValue={c.default_write_off_pct}
                title="Default write-off %"
                onBlur={(e) => {
                  const v = Number.parseInt(e.target.value, 10);
                  if (Number.isInteger(v) && v !== c.default_write_off_pct) {
                    update(c, { default_write_off_pct: v });
                  }
                }}
              />
            )}

            <button
              className="btn-secondary px-2 py-1 text-xs"
              onClick={() => {
                const newName = prompt('Category name:', c.name);
                if (newName && newName !== c.name) update(c, { name: newName });
              }}
            >
              Rename
            </button>
            <button className="btn-secondary px-2 py-1 text-xs" onClick={() => update(c, { archived: !c.archived })}>
              {c.archived ? 'Unarchive' : 'Archive'}
            </button>
            <button className="btn-danger px-2 py-1 text-xs" onClick={() => remove(c)}>Delete</button>
          </div>
        ))}
      </div>
    </section>
  );
}
