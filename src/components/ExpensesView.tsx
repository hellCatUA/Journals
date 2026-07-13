'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Account, Category, ExpenseRow, ExpenseStats, Group } from '@/lib/types';
import { writeOffCents } from '@/lib/types';
import { MONTH_NAMES, formatDateShort, formatMoney, monthRange } from '@/lib/format';
import CategoryIcon from './CategoryIcon';

type Period = { year: number; month: number } | 'all';

export default function ExpensesView() {
  const searchParams = useSearchParams();
  const now = new Date();

  const [period, setPeriod] = useState<Period>({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [groupId, setGroupId] = useState(searchParams.get('group_id') ?? '');
  const [writeOff, setWriteOff] = useState('');
  const [q, setQ] = useState('');

  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);

  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [stats, setStats] = useState<ExpenseStats>({ count: 0, total_cents: 0, write_off_cents: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/categories?all=1').then((r) => r.json()),
      fetch('/api/accounts?all=1').then((r) => r.json()),
      fetch('/api/groups').then((r) => r.json()),
    ])
      .then(([c, a, g]) => {
        setCategories(c.categories);
        setAccounts(a.accounts);
        setGroups(g.groups);
      })
      .catch(() => setError('Failed to load filters.'));
  }, []);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (period !== 'all') {
      const { from, to } = monthRange(period.year, period.month);
      params.set('from', from);
      params.set('to', to);
    }
    if (categoryId) params.set('category_id', categoryId);
    if (accountId) params.set('account_id', accountId);
    if (groupId) params.set('group_id', groupId);
    if (writeOff) params.set('write_off', writeOff);
    if (q.trim()) params.set('q', q.trim());
    return params.toString();
  }, [period, categoryId, accountId, groupId, writeOff, q]);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/expenses?${query}`)
      .then((r) => r.json())
      .then((data) => {
        setExpenses(data.expenses);
        setStats(data.stats);
        setError(null);
      })
      .catch(() => setError('Failed to load expenses.'))
      .finally(() => setLoading(false));
  }, [query]);

  useEffect(load, [load]);

  function shiftMonth(delta: number) {
    setPeriod((p) => {
      if (p === 'all') return { year: now.getFullYear(), month: now.getMonth() + 1 };
      const d = new Date(p.year, p.month - 1 + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() + 1 };
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Period switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button className="btn-secondary px-2.5" aria-label="Previous month" onClick={() => shiftMonth(-1)} disabled={period === 'all'}>
            ‹
          </button>
          <button
            className="btn-secondary min-w-40 font-semibold"
            onClick={() => setPeriod((p) => (p === 'all' ? { year: now.getFullYear(), month: now.getMonth() + 1 } : 'all'))}
            title="Toggle all time"
          >
            {period === 'all' ? 'All time' : `${MONTH_NAMES[period.month - 1]} ${period.year}`}
          </button>
          <button className="btn-secondary px-2.5" aria-label="Next month" onClick={() => shiftMonth(1)} disabled={period === 'all'}>
            ›
          </button>
        </div>
        <Link href="/add" className="btn-primary">+ Add expense</Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Total spent" value={formatMoney(stats.total_cents)} />
        <StatTile label="Write-off" value={formatMoney(stats.write_off_cents)} accent />
        <StatTile label="Entries" value={String(stats.count)} />
      </div>

      {/* Filters */}
      <div className="card grid grid-cols-2 gap-2 p-3 sm:grid-cols-5">
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
        <select className="input" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          <option value="">All groups</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
        <select className="input" value={writeOff} onChange={(e) => setWriteOff(e.target.value)}>
          <option value="">Write-off: any</option>
          <option value="yes">Write-off only</option>
          <option value="no">Non write-off</option>
        </select>
        <input
          className="input col-span-2 sm:col-span-1"
          placeholder="Search vendor/note…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {/* List */}
      <div className="card divide-y divide-zinc-100 dark:divide-zinc-800">
        {loading && expenses.length === 0 ? (
          <p className="p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
        ) : expenses.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No expenses for this period.</p>
            <Link href="/add" className="btn-primary mt-4">Add your first expense</Link>
          </div>
        ) : (
          expenses.map((e) => <ExpenseRowItem key={e.id} expense={e} />)
        )}
      </div>
    </div>
  );
}

function StatTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="card p-3 sm:p-4">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className={`mt-1 truncate text-lg font-semibold sm:text-2xl ${accent ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
        {value}
      </p>
    </div>
  );
}

function ExpenseRowItem({ expense: e }: { expense: ExpenseRow }) {
  const wo = writeOffCents(e);
  return (
    <Link
      href={`/expenses/${e.id}`}
      className="flex items-center gap-3 p-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
    >
      {/* Category icon tinted with the category color */}
      <span
        className="relative flex h-11 w-11 flex-none items-center justify-center rounded-full"
        style={{ backgroundColor: `${e.category_color ?? '#71717a'}1f` }}
      >
        <CategoryIcon icon={e.category_icon} color={e.category_color ?? '#71717a'} size={20} />
        {e.receipt_path && (
          <span
            title="Receipt attached"
            className="absolute -right-0.5 -bottom-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
          >
            <CategoryIcon icon="paperclip" color="currentColor" size={9} className="text-zinc-500 dark:text-zinc-400" />
          </span>
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {e.vendor || e.category_name || 'Expense'}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          <span>{formatDateShort(e.occurred_at)}</span>
          {e.category_name && (
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: e.category_color ?? '#71717a' }} />
              {e.category_name}
            </span>
          )}
          {e.account_name && <span>· {e.account_name}</span>}
          {e.group_names.map((g) => (
            <span key={g} className="rounded-full bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">{g}</span>
          ))}
        </p>
      </div>

      <div className="text-right">
        <p className="text-sm font-semibold whitespace-nowrap">{formatMoney(e.amount_cents)}</p>
        <p className="mt-0.5 text-xs whitespace-nowrap">
          {e.is_write_off ? (
            <span className="text-emerald-600 dark:text-emerald-400">
              W/O {e.write_off_pct}%{e.write_off_pct < 100 ? ` · ${formatMoney(wo)}` : ''}
            </span>
          ) : (
            <span className="text-zinc-400 dark:text-zinc-500">no write-off</span>
          )}
        </p>
      </div>
    </Link>
  );
}
