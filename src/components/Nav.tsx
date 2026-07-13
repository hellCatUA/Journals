'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ThemeToggle from './ThemeToggle';

const LINKS = [
  { href: '/', label: 'Expenses' },
  { href: '/add', label: 'Add' },
  { href: '/groups', label: 'Groups' },
  { href: '/export', label: 'Export' },
  { href: '/settings', label: 'Settings' },
];

export default function Nav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' || pathname.startsWith('/expenses') : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-2 px-4 py-3">
        <Link href="/" className="mr-2 flex items-center gap-2 font-semibold whitespace-nowrap">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-sm text-white">
            F
          </span>
          <span className="hidden sm:inline">Field Expenses</span>
        </Link>

        <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
          {LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
                isActive(href)
                  ? 'bg-emerald-600/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <ThemeToggle />
      </div>
    </header>
  );
}
