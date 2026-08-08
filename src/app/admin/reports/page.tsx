'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Download, FileText, RefreshCw, Search, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getClientErrorMessage, requestJson } from '@/lib/client-api';
import {
  getManilaDateString,
  type CollectionReport,
  type OutstandingBalanceItem,
  type ReversalReportItem,
} from '@/lib/reports';
import { formatCentavos } from '@/lib/utils/currency';

function defaultRange() {
  const today = getManilaDateString();
  return { from: `${today.slice(0, 8)}01`, to: today };
}

function reportUrl(kind: string, from: string, to: string) {
  return `/api/reports/csv?kind=${kind}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
}

function reconciliationClass(status: string) {
  if (status === 'RECONCILED') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'REVERSED') return 'border-rose-200 bg-rose-50 text-rose-700';
  return 'border-amber-200 bg-amber-50 text-amber-700';
}

function QueryError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 p-6">
      <p className="text-sm text-red-600">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry
      </Button>
    </div>
  );
}

export default function AdminReportsPage() {
  const initial = useMemo(defaultRange, []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [applied, setApplied] = useState(initial);

  const collectionsQuery = useQuery({
    queryKey: ['admin-report-collections', applied.from, applied.to],
    queryFn: () =>
      requestJson<CollectionReport>(
        `/api/reports/collections?from=${applied.from}&to=${applied.to}`
      ),
  });
  const outstandingQuery = useQuery({
    queryKey: ['admin-report-outstanding'],
    queryFn: () => requestJson<{ items: OutstandingBalanceItem[] }>('/api/reports/outstanding'),
  });
  const reversalsQuery = useQuery({
    queryKey: ['admin-report-reversals', applied.from, applied.to],
    queryFn: () =>
      requestJson<{ dateRange: { from: string; to: string }; items: ReversalReportItem[] }>(
        `/api/reports/reversals?from=${applied.from}&to=${applied.to}`
      ),
  });
  const collections = collectionsQuery.data;
  const outstanding = outstandingQuery.data?.items ?? [];
  const reversals = reversalsQuery.data?.items ?? [];

  function applyRange(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setApplied({ from, to });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
            Finance · reports & reconciliation
          </Badge>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Financial reports and statements
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            All totals are read from PostgreSQL and use Asia/Manila date boundaries.
          </p>
        </div>
        <form className="flex flex-wrap items-end gap-2" onSubmit={applyRange}>
          <label className="text-[11px] font-medium text-slate-500">
            From
            <Input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="mt-1 h-9 w-36 text-xs"
            />
          </label>
          <label className="text-[11px] font-medium text-slate-500">
            To
            <Input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="mt-1 h-9 w-36 text-xs"
            />
          </label>
          <Button type="submit" className="h-9 bg-blue-600 text-xs text-white hover:bg-blue-700">
            <Search className="mr-1.5 h-3.5 w-3.5" /> Apply
          </Button>
        </form>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          [
            'Net collections',
            collections ? formatCentavos(collections.totals.netCollectionsCentavos) : '—',
          ],
          [
            'Reversed amount',
            collections ? formatCentavos(collections.totals.reversedCentavos) : '—',
          ],
          [
            'Posted transactions',
            collections?.totals.postedTransactionCount.toLocaleString() ?? '—',
          ],
          [
            'Outstanding balances',
            formatCentavos(
              outstanding.reduce((sum, row) => sum + row.outstandingBalanceCentavos, 0)
            ),
          ],
        ].map(([label, value]) => (
          <Card key={label} className="border-slate-200 shadow-sm dark:border-slate-800">
            <CardContent className="p-5">
              <p className="text-xs font-semibold text-slate-500">{label}</p>
              <p className="mt-2 text-xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-slate-200 shadow-sm dark:border-slate-800">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Collection and payment history</CardTitle>
            <p className="text-xs text-slate-500">
              {applied.from} through {applied.to}; posted totals exclude reversals.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={reportUrl('collections', applied.from, applied.to)}>
              <Button variant="outline" size="sm" className="text-xs">
                <Download className="mr-1 h-3.5 w-3.5" /> Collections CSV
              </Button>
            </a>
            <a href={reportUrl('payment-method', applied.from, applied.to)}>
              <Button variant="outline" size="sm" className="text-xs">
                By method CSV
              </Button>
            </a>
            <a href={reportUrl('grade-level', applied.from, applied.to)}>
              <Button variant="outline" size="sm" className="text-xs">
                By grade CSV
              </Button>
            </a>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {collectionsQuery.isLoading && (
            <p className="p-6 text-sm text-slate-500">Loading collection report…</p>
          )}
          {collectionsQuery.isError && (
            <QueryError
              message={getClientErrorMessage(collectionsQuery.error)}
              onRetry={() => void collectionsQuery.refetch()}
            />
          )}
          {collections && collections.items.length === 0 && (
            <p className="p-6 text-sm text-slate-500">No payment records in this date range.</p>
          )}
          {collections && collections.items.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Receipt</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reconciliation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {collections.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="whitespace-nowrap text-xs text-slate-500">
                      {item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-PH') : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs font-semibold">{item.studentName}</div>
                      <div className="font-mono text-[10px] text-slate-500">
                        {item.studentNumber}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {item.receiptNumber ?? 'Missing'}
                    </TableCell>
                    <TableCell className="text-xs">{item.paymentMethod}</TableCell>
                    <TableCell className="text-xs font-bold">
                      {formatCentavos(item.amountCentavos)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${item.status === 'REVERSED' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}
                      >
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        title={item.note}
                        variant="outline"
                        className={`text-[10px] ${reconciliationClass(item.reconciliationStatus)}`}
                      >
                        {item.reconciliationStatus}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-slate-200 shadow-sm dark:border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Outstanding-balance report</CardTitle>
              <p className="text-xs text-slate-500">
                Active students with a positive ledger balance.
              </p>
            </div>
            <a href="/api/reports/csv?kind=outstanding">
              <Button variant="outline" size="sm" className="text-xs">
                <Download className="mr-1 h-3.5 w-3.5" /> CSV
              </Button>
            </a>
          </CardHeader>
          <CardContent className="p-0">
            {outstandingQuery.isLoading && (
              <p className="p-6 text-sm text-slate-500">Loading balances…</p>
            )}
            {outstandingQuery.isError && (
              <QueryError
                message={getClientErrorMessage(outstandingQuery.error)}
                onRetry={() => void outstandingQuery.refetch()}
              />
            )}
            {outstanding.length === 0 && !outstandingQuery.isLoading && (
              <p className="p-6 text-sm text-slate-500">No active outstanding balances.</p>
            )}
            {outstanding.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {outstanding.slice(0, 12).map((row) => (
                    <TableRow key={row.studentId}>
                      <TableCell>
                        <div className="text-xs font-semibold">{row.studentName}</div>
                        <div className="font-mono text-[10px] text-slate-500">
                          {row.studentNumber}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {row.gradeLevelName ?? 'Unassigned'}
                      </TableCell>
                      <TableCell className="text-xs font-bold">
                        {formatCentavos(row.outstandingBalanceCentavos)}
                      </TableCell>
                      <TableCell className="text-right">
                        <a href={`/api/reports/statements/${row.studentId}/pdf`}>
                          <Button variant="ghost" size="sm" className="h-8 text-xs text-blue-600">
                            <FileText className="mr-1 h-3.5 w-3.5" /> Statement
                          </Button>
                        </a>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm dark:border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Reversal report</CardTitle>
              <p className="text-xs text-slate-500">
                Audit-preserved reversals in the applied period.
              </p>
            </div>
            <a href={reportUrl('reversals', applied.from, applied.to)}>
              <Button variant="outline" size="sm" className="text-xs">
                <Download className="mr-1 h-3.5 w-3.5" /> CSV
              </Button>
            </a>
          </CardHeader>
          <CardContent className="p-0">
            {reversalsQuery.isLoading && (
              <p className="p-6 text-sm text-slate-500">Loading reversals…</p>
            )}
            {reversalsQuery.isError && (
              <QueryError
                message={getClientErrorMessage(reversalsQuery.error)}
                onRetry={() => void reversalsQuery.refetch()}
              />
            )}
            {reversals.length === 0 && !reversalsQuery.isLoading && (
              <p className="p-6 text-sm text-slate-500">No reversals in this date range.</p>
            )}
            {reversals.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reversals.slice(0, 12).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-xs text-slate-500">
                        {new Date(row.reversedAt).toLocaleDateString('en-PH')}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-semibold">{row.studentName}</div>
                        <div className="font-mono text-[10px] text-slate-500">
                          {row.receiptNumber ?? row.paymentId}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-bold text-rose-700">
                        {formatCentavos(row.amountCentavos)}
                      </TableCell>
                      <TableCell className="max-w-48 text-xs text-slate-500">
                        {row.reason}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-500">
        <AlertCircle className="h-3.5 w-3.5" /> Reconciliation flags are computed from persisted
        receipt and allocation totals; REVIEW rows require finance follow-up.
      </div>
      <Link
        href="/admin/dashboard"
        className="inline-flex items-center text-xs font-medium text-blue-600 hover:underline"
      >
        <TrendingUp className="mr-1 h-3.5 w-3.5" /> Back to dashboard
      </Link>
    </div>
  );
}
