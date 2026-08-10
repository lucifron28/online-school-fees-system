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
      <body className="flex min-h-[100dvh] items-center justify-center bg-slate-950 p-6 text-white">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="text-2xl font-bold">Critical Application Error</h1>
          <p className="rounded bg-slate-800 p-3 text-left font-mono text-xs text-slate-400">
            Unexpected application error. Please try again.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="min-h-11 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            Reset Application
          </button>
        </div>
      </body>
    </html>
  );
}
