import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, Server, ShieldCheck, Database, Layers } from 'lucide-react';

export default function HomePage() {
  const stackItems = [
    { name: 'Next.js (App Router)', type: 'Framework' },
    { name: 'TypeScript (Strict)', type: 'Language' },
    { name: 'Tailwind CSS & shadcn/ui', type: 'Styling & UI' },
    { name: 'TanStack Query / Form / Table', type: 'State & Tables' },
    { name: 'Drizzle ORM & Neon PostgreSQL', type: 'Database' },
    { name: 'Better Auth', type: 'Authentication' },
    { name: 'Vitest & Playwright', type: 'Testing' },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="space-y-8">
        {/* Header section */}
        <div className="space-y-3">
          <Badge
            variant="outline"
            className="border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
          >
            Branch: chore/project-foundation
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-4xl">
            Online School Fees Monitoring and Payment Information System
          </h1>
          <p className="max-w-3xl text-lg text-slate-600 dark:text-slate-300">
            Mother Perpetua Parochial School — Core application foundation, architecture, testing
            tools, and baseline environment setup.
          </p>
        </div>

        <Separator />

        {/* Foundation Status Card */}
        <Card className="border-emerald-200 bg-white shadow-sm dark:border-emerald-900/50 dark:bg-slate-900">
          <CardHeader className="flex flex-row items-center space-x-4 space-y-0 pb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <CardTitle className="text-xl text-slate-900 dark:text-slate-100">
                System Foundation Ready
              </CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400">
                The technical baseline is configured, tested, and ready for feature branches.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-950/50">
                <div className="flex items-center space-x-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <Server className="h-4 w-4 text-slate-700 dark:text-slate-300" />
                  <span>App Router</span>
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Active & Isolated
                </p>
              </div>

              <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-950/50">
                <div className="flex items-center space-x-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <Database className="h-4 w-4 text-slate-700 dark:text-slate-300" />
                  <span>Drizzle ORM</span>
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Configured (Neon)
                </p>
              </div>

              <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-950/50">
                <div className="flex items-center space-x-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <ShieldCheck className="h-4 w-4 text-slate-700 dark:text-slate-300" />
                  <span>Quality & Tests</span>
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Vitest & Playwright
                </p>
              </div>

              <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-950/50">
                <div className="flex items-center space-x-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <Layers className="h-4 w-4 text-slate-700 dark:text-slate-300" />
                  <span>State Boundaries</span>
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Defined & Documented
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Technology Summary */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Technology Stack Baseline
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stackItems.map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {item.name}
                </span>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  {item.type}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
