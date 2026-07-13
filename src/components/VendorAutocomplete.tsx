'use client';

import { useEffect, useRef, useState } from 'react';
import type { VendorSuggestion } from '@/lib/types';

/**
 * Vendor input with history-based suggestions. Picking a suggestion also
 * hands the vendor's most frequent category/account to the parent so the
 * form can prefill them.
 */
export default function VendorAutocomplete({
  value,
  onChange,
  onPick,
}: {
  value: string;
  onChange: (vendor: string) => void;
  onPick: (s: VendorSuggestion) => void;
}) {
  const [items, setItems] = useState<VendorSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [focused, setFocused] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const skipNextFetch = useRef(false);

  useEffect(() => {
    if (!focused) return;
    if (skipNextFetch.current) {
      skipNextFetch.current = false;
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/vendors?q=${encodeURIComponent(value.trim())}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((data: { suggestions: VendorSuggestion[] }) => {
          // Hide the list when the input already equals the only suggestion.
          const items = data.suggestions.filter(
            (s) => !(data.suggestions.length === 1 && s.vendor.toLowerCase() === value.trim().toLowerCase())
          );
          setItems(items);
          setOpen(items.length > 0);
          setHighlight(-1);
        })
        .catch(() => {});
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, focused]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function pick(s: VendorSuggestion) {
    skipNextFetch.current = true;
    onPick(s);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || items.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => (h + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => (h <= 0 ? items.length - 1 : h - 1));
    } else if (e.key === 'Enter' && highlight >= 0) {
      e.preventDefault();
      pick(items[highlight]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        id="vendor"
        className="input"
        placeholder="e.g. Home Depot"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul className="absolute top-full right-0 left-0 z-30 mt-1 max-h-60 overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {items.map((s, i) => (
            <li key={s.vendor}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault(); // keep input focus
                  pick(s);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={`flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2 text-left text-sm ${
                  i === highlight ? 'bg-emerald-600/10 dark:bg-emerald-500/15' : ''
                }`}
              >
                <span className="min-w-0 flex-1 truncate font-medium">{s.vendor}</span>
                {s.category_name && (
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] whitespace-nowrap text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    {s.category_name}
                  </span>
                )}
                <span className="text-[11px] whitespace-nowrap text-zinc-400 dark:text-zinc-500">
                  ×{s.uses}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
