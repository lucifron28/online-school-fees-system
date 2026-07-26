import type { Metadata } from 'next';
import './globals.css';
import { QueryProvider } from '@/lib/query/provider';

export const metadata: Metadata = {
  title: 'Online School Fees Monitoring and Payment Information System',
  description:
    'Technical foundation for Mother Perpetua Parochial School online school fees monitoring, assessment, and payment system.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-50">
        <QueryProvider>
          <header className="border-b border-slate-200 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
              <div className="flex items-center space-x-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 font-bold text-white shadow-sm dark:bg-slate-100 dark:text-slate-900">
                  MP
                </div>
                <div>
                  <h1 className="text-sm font-semibold leading-none tracking-tight text-slate-900 dark:text-slate-100">
                    Mother Perpetua Parochial School
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Online School Fees System
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  v0.1.0 • Foundation
                </span>
              </div>
            </div>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              Online School Fees Monitoring and Payment Information System — Mother Perpetua
              Parochial School
            </div>
          </footer>
        </QueryProvider>
      </body>
    </html>
  );
}
