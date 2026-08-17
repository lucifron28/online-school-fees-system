'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { Eye, RefreshCw } from 'lucide-react';
import { getClientErrorMessage, requestJson } from '@/lib/client-api';
import { formatCentavos } from '@/lib/utils/currency';
import type { PortalPaymentsPage } from '@/lib/portal-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PaginationControls } from '@/components/ui/pagination-controls';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function ParentPaymentHistoryPage() {
  const searchParams = useSearchParams();
  const studentId = searchParams.get('studentId') ?? undefined;
  const [page, setPage] = useState(1);

  useEffect(() => setPage(1), [studentId]);

  const paymentsQuery = useQuery({
    queryKey: ['parent-payments', studentId, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (studentId) params.set('studentId', studentId);
      return requestJson<PortalPaymentsPage>(`/api/portal/parent/payments?${params}`);
    },
  });
  const payments = paymentsQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <div>
        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
          Parent payment history
        </Badge>
        <h2 className="mt-1 text-2xl font-bold tracking-tight">
          {studentId ? 'Child payment history' : 'Payment history'}
        </h2>
        <p className="text-xs text-slate-500">Finance-posted transactions for linked children.</p>
      </div>

      {paymentsQuery.isLoading && <p className="text-sm text-slate-500">Loading payments…</p>}
      {paymentsQuery.isError && (
        <Card>
          <CardContent className="space-y-3 p-6">
            <p className="text-sm text-rose-600">{getClientErrorMessage(paymentsQuery.error)}</p>
            <Button variant="outline" onClick={() => void paymentsQuery.refetch()}>
              <RefreshCw className="mr-1.5 h-4 w-4" /> Retry
            </Button>
          </CardContent>
        </Card>
      )}
      {paymentsQuery.data && (
        <Card className="shadow-sm">
          <CardContent className="p-0">
            {payments.length === 0 ? (
              <EmptyState
                title="No posted payments yet"
                description={
                  studentId
                    ? 'This child has no finance-posted transactions in the selected account.'
                    : 'Finance-posted transactions for linked children will appear here.'
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Receipt</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-mono text-xs font-bold">
                        {payment.receiptId ? payment.receiptNumber : 'No receipt'}
                      </TableCell>
                      <TableCell className="text-xs">{payment.studentName}</TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {new Date(payment.createdAt).toLocaleString('en-PH')}
                      </TableCell>
                      <TableCell className="text-xs font-bold">
                        {formatCentavos(payment.amountCentavos)}
                      </TableCell>
                      <TableCell className="text-xs">{payment.paymentMethod}</TableCell>
                      <TableCell className="text-xs">{payment.status}</TableCell>
                      <TableCell className="text-right">
                        {payment.receiptId && (
                          <Link href={`/parent/receipts/${payment.receiptId}`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs text-emerald-700"
                            >
                              <Eye className="mr-1 h-3.5 w-3.5" /> View receipt
                            </Button>
                          </Link>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {paymentsQuery.data && (
              <PaginationControls
                {...paymentsQuery.data.pagination}
                isFetching={paymentsQuery.isFetching}
                onPageChange={setPage}
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
