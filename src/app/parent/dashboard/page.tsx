'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, DollarSign, ChevronRight, RefreshCw } from 'lucide-react';
import { getClientErrorMessage, requestJson } from '@/lib/client-api';
import { formatCentavos } from '@/lib/utils/currency';
import type { PortalChild } from '@/lib/portal-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ParentDashboardPage() {
  const childrenQuery = useQuery({
    queryKey: ['parent-children'],
    queryFn: () => requestJson<PortalChild[]>('/api/portal/parent/children'),
  });
  const children = childrenQuery.data ?? [];
  const outstanding = children.reduce(
    (total, child) => total + child.outstandingBalanceCentavos,
    0
  );
  const paid = children.reduce((total, child) => total + child.totalPaidCentavos, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
            Parent dashboard
          </Badge>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Your children
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Finance-posted assessments and payments linked to your account.
          </p>
        </div>
        <Link href="/parent/pay">
          <Button className="h-9 bg-emerald-600 text-xs text-white shadow-sm hover:bg-emerald-700">
            <CreditCard className="mr-1.5 h-4 w-4" /> Make mock online payment
          </Button>
        </Link>
      </div>

      {childrenQuery.isLoading && (
        <p className="text-sm text-slate-500">Loading linked children…</p>
      )}
      {childrenQuery.isError && (
        <Card>
          <CardContent className="space-y-3 p-6">
            <p className="text-sm text-rose-600">{getClientErrorMessage(childrenQuery.error)}</p>
            <Button variant="outline" onClick={() => void childrenQuery.refetch()}>
              <RefreshCw className="mr-1.5 h-4 w-4" /> Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {childrenQuery.data && children.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-sm text-slate-500">
            No students are linked to this parent account.
          </CardContent>
        </Card>
      )}

      {children.length > 0 && (
        <>
          <div className="grid gap-6 sm:grid-cols-2">
            <Card className="border-emerald-200 bg-emerald-50/40 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-800">Total outstanding</span>
                  <CreditCard className="h-5 w-5 text-emerald-700" />
                </div>
                <div className="mt-3 text-3xl font-extrabold text-slate-900">
                  {formatCentavos(outstanding)}
                </div>
                <p className="mt-1 text-xs text-slate-500">Across linked children</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Total posted paid</span>
                  <DollarSign className="h-5 w-5 text-blue-600" />
                </div>
                <div className="mt-3 text-3xl font-extrabold text-slate-900">
                  {formatCentavos(paid)}
                </div>
                <p className="mt-1 text-xs text-slate-500">Persisted finance ledger credits</p>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-sm">
            <CardHeader className="border-b">
              <CardTitle className="text-base">Linked children</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {children.map((child) => (
                  <div
                    key={child.studentId}
                    className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center"
                  >
                    <div>
                      <h4 className="text-sm font-bold">
                        {child.firstName} {child.lastName}
                      </h4>
                      <p className="font-mono text-xs text-slate-500">
                        {child.studentNumber} · {child.gradeLevelName ?? 'Grade not assigned'}
                        {child.sectionName ? ` · ${child.sectionName}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-6 sm:justify-end">
                      <div className="text-right">
                        <span className="text-[11px] text-slate-500">Outstanding</span>
                        <p className="text-base font-extrabold text-rose-600">
                          {formatCentavos(child.outstandingBalanceCentavos)}
                        </p>
                      </div>
                      <Link href={`/parent/children/${child.studentId}`}>
                        <Button variant="outline" size="sm" className="h-9 text-xs">
                          View details <ChevronRight className="ml-1 h-4 w-4 text-slate-400" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
