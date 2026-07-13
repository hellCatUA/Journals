'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Account, Category, ExpenseStats, Group } from '@/lib/types';
import { formatMoney, localDateISO, monthRange, todayISO, weekRange } from '@/lib/format';

type Preset = 'this_month' | 'last_month' | 'this_week' | 'last_week' | 'this_year' | 'all' | 'custom';

const PRESETS: Array<{ id: Preset; label: string }> = [
  { id: 'this_month', label: 'This month' },
  { id: 'last_month', label: 'Last month' },
  { id: 'this_week', label: 'This week' },
  { id: 'last_week', label: 'Last week' },
  { id: 'this_year', label: 'This year' },
  { id: 'all', label: 'All time' },
  { id: 'custom', label: 'Custom range' },
];

function presetRange(preset: Preset): { from: string; to: string } | null {
  const now = new Date();
  switch (preset) {
    case 'this_month':
      return monthRange(now.getFullYear(), now.getMonth() + 1);
    case 'last_month': {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return monthRange(d.getFullYear(), d.getMonth() + 1);
    }
    case 'this_week':
      return weekRange(now);
    case 'last_week': {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return weekRange(d);
    }
    case 'this_year':
      return { from: `${now.getFullYear()}-01-01`, to: localDateISO(now) };
    default:
      return null;
  }
}

export default function ExportView() {
  const [preset, setPreset] = useState<Preset>('this_month');
  const [customFrom, setCustomFrom] = useState(todayISO().slice(0, 8) + '01');
  const [customTo, setCustomTo] = useState(todayISO());
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [writeOff, setWriteOff] = useState('');

  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [stats, setStats] = useState<ExpenseStats | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/categories?all=1').then((r) => r.json()),
      fetch('/api/accounts?all=1').then((r) => r.json()),
      fetch('/api/groups').then((r) => r.json()),
    ]).then(([c, a, g]) => {
      setCategories(c.categories);
      setAccounts(a.accounts);
      setGroups(g.groups);
    });
  }, []);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    const range = preset === 'custom' ? { from: customFrom, to: customTo } : presetRange(preset);
    if (range?.from) params.set('from', range.from);
    if (range?.to) params.set('to', range.to);
    if (categoryId) params.set('category_id', categoryId);
    if (accountId) params.set('account_id', accountId);
    if (groupId) params.set('group_id', groupId);
    if (writeOff) params.set('write_off', writeOff);
    return params.toString();
  }, [preset, customFrom, customTo, categoryId, accountId, groupId, writeOff]);

  useEffect(() => {
    setStats(null);
    const controller = new AbortController();
    fetch(`/api/expenses?${query}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => setStats(data.stats))
      .catch(() => {});
    return () => controller.abort();
  }, [query]);

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-xl font-semibold">Export to CSV</h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Download expenses as a CSV file (opens in Excel / Google Sheets). Includes write-off amounts,
        groups and receipt file paths, plus a totals row.
      </p>

      <div className="card flex flex-col gap-4 p-4">
        <div>
          <span className="label">Period</span>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPreset(p.id)}
                className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  preset === p.id
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-zinc-300 text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {preset === 'custom' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="from">From</label>
              <input id="from" type="date" className="input" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="to">To</label>
              <input id="to" type="date" className="input" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <select className="input" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            <option value="">All groups</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <select className="input" value={writeOff} onChange={(e) => setWriteOff(e.target.value)}>
            <option value="">Write-off: any</option>
            <option value="yes">Write-off only</option>
            <option value="no">Non write-off</option>
          </select>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-950">
          {stats ? (
            <span className="text-zinc-600 dark:text-zinc-300">
              {stats.count} expense(s) · {formatMoney(stats.total_cents)} total ·{' '}
              <span className="text-emerald-600 dark:text-emerald-400">{formatMoney(stats.write_off_cents)} write-off</span>
            </span>
          ) : (
            <span className="text-zinc-400">Counting…</span>
          )}
        </div>

        <a
          href={`/api/export?${query}`}
          download
          className={`btn-primary ${stats?.count === 0 ? 'pointer-events-none opacity-50' : ''}`}
        >
          Download CSV
        </a>
      </div>
    </div>
  );
}
