import type { Metadata, Viewport } from 'next';
import './globals.css';
import Nav from '@/components/Nav';

export const metadata: Metadata = {
  title: 'Journals',
  description: 'Self-hosted business expense journal with receipt OCR',
  appleWebApp: {
    title: 'Journals',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

const themeInit = `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':true;if(d)document.documentElement.classList.add('dark');}catch(e){document.documentElement.classList.add('dark');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-screen">
        <Nav />
        <main className="mx-auto w-full max-w-5xl px-4 pt-6 pb-24 sm:pb-10">{children}</main>
      </body>
    </html>
  );
}
