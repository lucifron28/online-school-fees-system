import type { Metadata } from 'next';
import Link from 'next/link';
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
    <html lang="en" className="min-h-full">
      <body className="flex min-h-[100dvh] flex-col">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <QueryProvider>
          <header className="border-b border-border/80 bg-background/90 backdrop-blur-md">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
              <Link href="/" className="flex items-center gap-3 rounded-lg" aria-label="School fees home">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground text-xs font-bold text-background shadow-sm">
                  MP
                </div>
                <div>
                  <span className="block text-sm font-semibold leading-none tracking-tight text-foreground">
                    Online School Fees
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">School finance portal</span>
                </div>
              </Link>
              <span className="hidden rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground sm:inline-flex">
                Secure school finance workspace
              </span>
            </div>
          </header>
          <div id="main-content" className="flex-1">
            {children}
          </div>
          <footer className="border-t border-border bg-card py-5 text-center text-xs text-muted-foreground">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              Online School Fees Monitoring and Payment Information System
            </div>
          </footer>
        </QueryProvider>
      </body>
    </html>
  );
}
