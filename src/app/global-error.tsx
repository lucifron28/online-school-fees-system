'use client';

import React from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-slate-900 p-6 text-white">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="text-2xl font-bold">Critical Application Error</h1>
          <p className="rounded bg-slate-800 p-3 text-left font-mono text-xs text-slate-400">
            {error.message || 'Fatal error rendering root layout'}
          </p>
          <button
            onClick={() => reset()}
            className="rounded bg-blue-600 px-4 py-2 text-xs font-semibold hover:bg-blue-500"
          >
            Reset Application
          </button>
        </div>
      </body>
    </html>
  );
}
