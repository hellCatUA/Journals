'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import CategoryIcon from './CategoryIcon';

let cachedNames: string[] | null = null;

async function loadIconNames(): Promise<string[]> {
  if (!cachedNames) {
    const res = await fetch('/icons/index.json');
    cachedNames = (await res.json()) as string[];
  }
  return cachedNames;
}

const SHOW_LIMIT = 96;

/**
 * Searchable picker over the Lucide icon set. Renders as a button showing
 * the current icon; clicking it opens an inline panel with a search box.
 */
export default function IconPicker({
  value,
  color,
  onChange,
}: {
  value: string;
  color: string;
  onChange: (icon: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [names, setNames] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) loadIconNames().then(setNames);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const matches = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    const filtered = terms.length
      ? names.filter((n) => terms.every((t) => n.includes(t)))
      : names;
    return filtered.slice(0, SHOW_LIMIT);
  }, [names, q]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        title={value ? `Icon: ${value}` : 'Pick an icon'}
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-zinc-300 bg-white transition-colors hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-500"
      >
        {value ? (
          <CategoryIcon icon={value} color={color} size={18} />
        ) : (
          <span className="text-xs text-zinc-400">?</span>
        )}
      </button>

      {open && (
        <div className="absolute top-11 left-0 z-30 w-72 rounded-xl border border-zinc-200 bg-white p-3 shadow-lg sm:w-80 dark:border-zinc-700 dark:bg-zinc-900">
          <input
            autoFocus
            className="input mb-2"
            placeholder="Search icons… (e.g. car, wifi, tool)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="grid max-h-56 grid-cols-8 gap-1 overflow-y-auto">
            {names.length === 0 ? (
              <p className="col-span-8 py-4 text-center text-xs text-zinc-400">Loading…</p>
            ) : matches.length === 0 ? (
              <p className="col-span-8 py-4 text-center text-xs text-zinc-400">No icons match “{q}”</p>
            ) : (
              matches.map((n) => (
                <button
                  key={n}
                  type="button"
                  title={n}
                  onClick={() => {
                    onChange(n);
                    setOpen(false);
                  }}
                  className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                    n === value ? 'bg-emerald-600/15 ring-1 ring-emerald-600' : ''
                  }`}
                >
                  <CategoryIcon icon={n} color="currentColor" size={16} className="text-zinc-600 dark:text-zinc-300" />
                </button>
              ))
            )}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-[10px] text-zinc-400">
              {q ? `${matches.length}${matches.length === SHOW_LIMIT ? '+' : ''} match(es)` : `${names.length} icons`}
            </p>
            {value && (
              <button
                type="button"
                className="cursor-pointer text-xs text-zinc-500 hover:text-red-500"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
              >
                Remove icon
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
