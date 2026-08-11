'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  DollarSign,
  Plus,
  Receipt,
  RefreshCw,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getClientErrorMessage, requestJson } from '@/lib/client-api';
import { formatCentavos } from '@/lib/utils/currency';
import type { DashboardMetrics } from '@/lib/reports';

function statusClass(status: string) {
  return status === 'REVERSED'
    ? 'border-rose-200 bg-rose-50 text-rose-700'
    : 'border-emerald-200 bg-emerald-50 text-emerald-700';
}

export default function AdminDashboardPage() {
  const summaryQuery = useQuery({
    queryKey: ['admin-report-summary'],
    queryFn: () => requestJson<DashboardMetrics>('/api/reports/summary'),
  });
  const data = summaryQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
            Finance overview
          </Badge>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            School collections overview
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Current balances, net collections, and persisted payment activity.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/reports">
            <Button variant="outline" className="h-9 text-xs">
              <BarChart3 className="mr-1.5 h-4 w-4" /> Reports
            </Button>
          </Link>
          <Link href="/admin/payments/manual">
            <Button className="h-9 bg-blue-600 text-xs text-white shadow-sm hover:bg-blue-700">
              <Plus className="mr-1.5 h-4 w-4" /> Post OTC payment
            </Button>
          </Link>
        </div>
      </div>

      {summaryQuery.isLoading && (
        <Card>
          <CardContent className="p-6 text-sm text-slate-500">
            Loading persisted metrics…
          </CardContent>
        </Card>
      )}
      {summaryQuery.isError && (
        <Card>
          <CardContent className="flex items-center justify-between gap-4 p-6">
            <p className="text-sm text-red-600">{getClientErrorMessage(summaryQuery.error)}</p>
            <Button variant="outline" size="sm" onClick={() => void summaryQuery.refetch()}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: 'Active Students',
                value: data.activeStudents.toLocaleString(),
                subtext: 'Active enrolled records',
                icon: Users,
                color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/50',
              },
              {
                title: 'Collections Today',
                value: formatCentavos(data.collectionsTodayCentavos),
                subtext: 'Net posted payments',
                icon: DollarSign,
                color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50',
              },
              {
                title: 'Collections This Month',
                value: formatCentavos(data.collectionsMonthCentavos),
                subtext: 'Reversed payments excluded',
                icon: TrendingUp,
                color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/50',
              },
              {
                title: 'Outstanding Balance (All Statuses)',
                value: formatCentavos(data.outstandingBalanceCentavos),
                subtext: `${data.postedTransactionsCount.toLocaleString()} posted transactions`,
                icon: AlertCircle,
                color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/50',
              },
            ].map((metric) => {
              const Icon = metric.icon;
              return (
                <Card
                  key={metric.title}
                  className="border-slate-200 shadow-sm dark:border-slate-800"
                >
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {metric.title}
                      </span>
                      <div className={`rounded-xl p-2 ${metric.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
                        {metric.value}
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                        {metric.subtext}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="border-slate-200 shadow-sm dark:border-slate-800 lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-base font-semibold">Collection trend</CardTitle>
                  <p className="text-xs text-slate-500">
                    Net posted collections by Manila calendar month.
                  </p>
                </div>
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="flex h-64 items-end gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-4 pb-4 pt-6 dark:border-slate-800 dark:bg-slate-900/50">
                  {(() => {
                    const max = Math.max(
                      ...data.collectionTrend.map((item) => item.amountCentavos),
                      1
                    );
                    return data.collectionTrend.map((item) => (
                      <div
                        key={item.period}
                        className="flex h-full flex-1 flex-col items-center justify-end gap-2"
                      >
                        <span className="text-[10px] text-slate-500">
                          {item.amountCentavos > 0
                            ? formatCentavos(item.amountCentavos)
                            : 'No collections'}
                        </span>
                        <div
                          className="w-full max-w-10 rounded-t-md bg-blue-600/80 transition-all"
                          style={{ height: `${Math.max(5, (item.amountCentavos / max) * 78)}%` }}
                        />
                        <span className="font-mono text-[10px] text-slate-500">{item.label}</span>
                      </div>
                    ));
                  })()}
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm dark:border-slate-800">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Payment methods</CardTitle>
                <p className="text-xs text-slate-500">Current-month net collections.</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.paymentMethodBreakdown.length === 0 && (
                  <p className="text-sm text-slate-500">No posted collections this month.</p>
                )}
                {data.paymentMethodBreakdown.map((method) => (
                  <div
                    key={method.key}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="text-xs font-semibold">{method.label}</p>
                      <p className="text-[11px] text-slate-500">
                        {method.transactionCount} transaction(s)
                      </p>
                    </div>
                    <p className="text-sm font-bold">{formatCentavos(method.amountCentavos)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card className="border-slate-200 shadow-sm dark:border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-semibold">Recent transactions</CardTitle>
                <p className="text-xs text-slate-500">
                  Latest persisted payment and reversal records.
                </p>
              </div>
              <Link
                href="/admin/transactions"
                className="flex items-center text-xs font-medium text-blue-600 hover:underline"
              >
                View all <ArrowUpRight className="ml-0.5 h-3.5 w-3.5" />
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {data.recentTransactions.length === 0 && (
                <p className="p-6 text-sm text-slate-500">No persisted payment records yet.</p>
              )}
              {data.recentTransactions.length > 0 && (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.recentTransactions.map((transaction) => (
                    <Link
                      key={transaction.id}
                      href={`/admin/transactions/${transaction.id}`}
                      className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <div>
                        <p className="text-xs font-semibold">{transaction.studentName}</p>
                        <p className="font-mono text-[10px] text-slate-500">
                          {transaction.receiptNumber ?? transaction.id} ·{' '}
                          {transaction.studentNumber}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold">
                          {formatCentavos(transaction.amountCentavos)}
                        </p>
                        <Badge
                          variant="outline"
                          className={`mt-1 text-[10px] ${statusClass(transaction.status)}`}
                        >
                          {transaction.status}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Receipt className="h-3.5 w-3.5" />
            Reconciliation details and downloadable reports are available in{' '}
            <Link href="/admin/reports" className="font-medium text-blue-600 hover:underline">
              Reports & Reconciliation
            </Link>
            .
          </div>
        </>
      )}
    </div>
  );
}
