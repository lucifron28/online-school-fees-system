'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CreditCard, RefreshCw } from 'lucide-react';
import { getClientErrorMessage, requestJson } from '@/lib/client-api';
import { formatCentavos } from '@/lib/utils/currency';
import type { PortalAccount } from '@/lib/portal-types';
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

export default function ParentChildDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const accountQuery = useQuery({
    queryKey: ['parent-child-account', id],
    queryFn: () => requestJson<PortalAccount>(`/api/portal/parent/children/${id}`),
  });
  const account = accountQuery.data;

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/parent/dashboard">
          <Button variant="outline" size="sm" className="h-9 px-3 text-xs">
            <ArrowLeft className="mr-1 h-4 w-4" /> Dashboard
          </Button>
        </Link>
        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
          Linked child account
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
              <div className="flex items-center gap-4">
                <div className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-right">
                  <span className="text-xs font-semibold text-rose-700">Outstanding balance</span>
                  <p className="mt-1 text-2xl font-extrabold text-rose-600">
                    {formatCentavos(account.ledger.balanceCentavos)}
                  </p>
                </div>
                <Link href={`/parent/pay?studentId=${account.student.studentId}`}>
                  <Button className="bg-emerald-600 text-xs text-white hover:bg-emerald-700">
                    <CreditCard className="mr-1.5 h-4 w-4" /> Pay
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Finance-posted assessment breakdown</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {account.assessments.length === 0 ? (
                <p className="p-6 text-sm text-slate-500">No finance-posted assessments yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Assessment item</TableHead>
                      <TableHead>Assessment</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {account.assessments.flatMap((assessment) =>
                      assessment.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-xs font-semibold">{item.name}</TableCell>
                          <TableCell className="text-xs text-slate-500">
                            {assessment.schoolYearName} · {assessment.assessmentPeriod}
                          </TableCell>
                          <TableCell className="text-xs font-bold">
                            {formatCentavos(item.amountCentavos)}
                          </TableCell>
                          <TableCell className="text-xs">
                            {formatCentavos(assessment.balanceCentavos)} remaining on assessment
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Payment history</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {account.payments.length === 0 ? (
                <p className="p-6 text-sm text-slate-500">No payments posted for this student.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Receipt</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {account.payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-mono text-xs">
                          {payment.receiptId ? (
                            <Link
                              className="text-emerald-700 underline"
                              href={`/parent/receipts/${payment.receiptId}`}
                            >
                              {payment.receiptNumber}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">
                          {new Date(payment.createdAt).toLocaleString('en-PH')}
                        </TableCell>
                        <TableCell className="text-xs font-bold">
                          {formatCentavos(payment.amountCentavos)}
                        </TableCell>
                        <TableCell className="text-xs">{payment.paymentMethod}</TableCell>
                        <TableCell className="text-xs">{payment.status}</TableCell>
                      </TableRow>
                    ))}
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
