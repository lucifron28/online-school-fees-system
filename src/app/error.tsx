'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled App Error', { name: error.name, digest: error.digest });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center bg-slate-50 px-4 py-12 text-center dark:bg-slate-950">
      <div className="mx-auto max-w-md space-y-6">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
          <AlertTriangle className="h-10 w-10" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Something went wrong
          </h2>
          <p className="overflow-x-auto rounded border border-slate-200 bg-slate-100 p-3 text-left font-mono text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            Unexpected application error. Please try again or return home.
          </p>
        </div>

        <div className="flex items-center justify-center space-x-3 pt-2">
          <Button onClick={() => reset()} variant="outline" className="h-9 text-xs">
            <RefreshCw className="mr-1.5 h-4 w-4" />
            <span>Try Again</span>
          </Button>
          <Link href="/">
            <Button className="h-9 bg-blue-600 text-xs text-white hover:bg-blue-700">
              <Home className="mr-1.5 h-4 w-4" />
              <span>Go to Home</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
