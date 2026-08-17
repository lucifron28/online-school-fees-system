export default function Loading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading page resources"
      className="min-h-[60vh] bg-slate-50 p-6 dark:bg-slate-950"
    >
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="space-y-3">
          <div className="h-4 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-8 w-72 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-4 w-96 max-w-full animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="h-32 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
          <div className="h-32 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
          <div className="h-32 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
        </div>
        <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
        <p className="text-center text-xs font-medium text-slate-500 dark:text-slate-400">
          Loading page resources...
        </p>
      </div>
    </main>
  );
}
