'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { getClientErrorMessage, requestJson } from '@/lib/client-api';
import type { PortalAccount } from '@/lib/portal-types';
import { formatCentavos } from '@/lib/utils/currency';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function StudentAccountPage() {
  const accountQuery = useQuery({
    queryKey: ['student-account'],
    queryFn: () => requestJson<PortalAccount>('/api/portal/student/account'),
  });
  const account = accountQuery.data;

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/student/dashboard">
          <Button variant="outline" size="sm" className="h-9 px-3 text-xs">
            <ArrowLeft className="mr-1 h-4 w-4" /> Dashboard
          </Button>
        </Link>
        <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700">
          Student account
        </Badge>
      </div>

      {accountQuery.isLoading && <p className="text-sm text-slate-500">Loading account…</p>}
      {accountQuery.isError && (
        <Card>
          <CardContent className="space-y-3 p-6">
            <p className="text-sm text-rose-600">{getClientErrorMessage(accountQuery.error)}</p>
            <Button variant="outline" onClick={() => void accountQuery.refetch()}>
              <RefreshCw className="mr-1.5 h-4 w-4" /> Retry
            </Button>
          </CardContent>
        </Card>
      )}
      {account && (
        <>
          <Card className="shadow-sm">
            <CardContent className="flex flex-col justify-between gap-6 p-6 md:flex-row md:items-center">
              <div>
                <h2 className="text-xl font-bold">
                  {account.student.firstName} {account.student.lastName}
                </h2>
                <p className="mt-1 font-mono text-xs text-slate-500">
                  {account.student.studentNumber} ·{' '}
                  {account.student.gradeLevelName ?? 'Grade not assigned'}
                  {account.student.sectionName ? ` · ${account.student.sectionName}` : ''}
                </p>
                <p className="text-xs text-slate-500">
                  {account.student.schoolYearName ?? 'No school year'}
                </p>
              </div>
              <div className="rounded-xl border border-purple-100 bg-purple-50 p-4 text-right">
                <span className="text-xs font-semibold text-purple-700">Outstanding balance</span>
                <p className="mt-1 text-2xl font-extrabold text-purple-700">
                  {formatCentavos(account.ledger.balanceCentavos)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Finance-posted fee assessments</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {account.assessments.length === 0 ? (
                <p className="p-6 text-sm text-slate-500">No finance-posted assessments yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>School year</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Assessment balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {account.assessments.flatMap((assessment) =>
                      assessment.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-xs font-semibold">{item.name}</TableCell>
                          <TableCell className="text-xs text-slate-500">
                            {assessment.schoolYearName}
                          </TableCell>
                          <TableCell className="text-xs font-bold">
                            {formatCentavos(item.amountCentavos)}
                          </TableCell>
                          <TableCell className="text-xs">
                            {formatCentavos(assessment.balanceCentavos)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
