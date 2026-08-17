'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye, RefreshCw } from 'lucide-react';
import { getClientErrorMessage, requestJson } from '@/lib/client-api';
import type { PortalPaymentsPage } from '@/lib/portal-types';
import { formatCentavos } from '@/lib/utils/currency';
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

export default function StudentPaymentHistoryPage() {
  const [page, setPage] = useState(1);
  const paymentsQuery = useQuery({
    queryKey: ['student-payments', page],
    queryFn: () =>
      requestJson<PortalPaymentsPage>(`/api/portal/student/payments?page=${page}&pageSize=20`),
  });
  const payments = paymentsQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <div>
        <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
          Student payment history
        </Badge>
        <h2 className="mt-1 text-2xl font-bold tracking-tight">Payment history</h2>
        <p className="text-xs text-slate-500">
          Your finance-posted payments and System-Generated Payment Receipts.
        </p>
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
                description="Finance-posted payments and their receipts will appear here after processing."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Receipt</TableHead>
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
                        {payment.receiptNumber ?? 'No receipt'}
                      </TableCell>
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
                          <Link href={`/student/receipts/${payment.receiptId}`}>
                            <Button variant="ghost" size="sm" className="h-8 text-xs text-sky-700">
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
