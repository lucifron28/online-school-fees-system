'use client';

import Link from 'next/link';
import { use, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getClientErrorMessage, requestJson } from '@/lib/client-api';
import { formatCentavos } from '@/lib/utils/currency';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, RefreshCw } from 'lucide-react';

type PaymentDetail = {
  id: string;
  studentId: string;
  amountCentavos: number;
  paymentMethod: string;
  referenceNumber: string | null;
  status: string;
  createdAt: string;
  studentNumber: string;
  studentFirstName: string;
  studentLastName: string;
  gradeLevelName: string | null;
  sectionName: string | null;
  processedByName: string | null;
  receipt: {
    id: string;
    receiptNumber: string | null;
    verificationIdentifier: string | null;
    status: string | null;
  } | null;
  allocations: Array<{
    id: string;
    assessmentItemId: string;
    itemName: string;
    feeCategoryName: string;
    amountCentavos: number;
  }>;
  remainingBalanceCentavos: number;
};

function statusClass(status: string) {
  return status === 'POSTED'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-rose-200 bg-rose-50 text-rose-700';
}

export default function AdminTransactionDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const [reversalOpen, setReversalOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [reversalError, setReversalError] = useState('');
  const paymentQuery = useQuery({
    queryKey: ['admin-payment', id],
    queryFn: () => requestJson<PaymentDetail>(`/api/admin/payments/${id}`),
  });
  const reverseMutation = useMutation({
    mutationFn: () =>
      requestJson(`/api/admin/payments/${id}/reverse`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: async () => {
      setReversalOpen(false);
      setReason('');
      setReversalError('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-payment', id] }),
        queryClient.invalidateQueries({ queryKey: ['admin-payments'] }),
      ]);
    },
    onError: (error) => setReversalError(getClientErrorMessage(error)),
  });

  if (paymentQuery.isLoading) return <p className="p-6 text-sm text-slate-500">Loading payment…</p>;
  if (paymentQuery.isError || !paymentQuery.data) {
    return (
      <Card className="border-red-100 p-6">
        <p className="text-sm text-red-600">{getClientErrorMessage(paymentQuery.error)}</p>
        <Button className="mt-4" variant="outline" onClick={() => void paymentQuery.refetch()}>
          <RefreshCw className="mr-1 h-3.5 w-3.5" /> Retry
        </Button>
      </Card>
    );
  }

  const payment = paymentQuery.data;
  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/transactions">
          <Button variant="outline" size="sm" className="text-xs">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to transactions
          </Button>
        </Link>
        <div className="flex gap-2">
          {payment.receipt && (
            <a href={`/api/receipts/${payment.receipt.id}/pdf`} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm" className="text-xs">
                <Download className="mr-1 h-3.5 w-3.5" /> Receipt PDF
              </Button>
            </a>
          )}
          <Button
            size="sm"
            variant="outline"
            className="text-xs text-rose-700"
            disabled={payment.status !== 'POSTED'}
            onClick={() => {
              setReversalError('');
              setReversalOpen(true);
            }}
          >
            <AlertTriangle className="mr-1 h-3.5 w-3.5" /> Reverse payment
          </Button>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm dark:border-slate-800">
        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 dark:border-slate-800">
          <div>
            <span className="font-mono text-xs text-slate-500">Payment acknowledgment receipt</span>
            <CardTitle className="font-mono text-xl font-bold">
              {payment.receipt?.receiptNumber ?? 'Receipt pending'}
            </CardTitle>
          </div>
          <Badge variant="outline" className={`px-3 py-1 text-xs ${statusClass(payment.status)}`}>
            {payment.status === 'POSTED' && <CheckCircle2 className="mr-1 h-3.5 w-3.5" />}
            {payment.status}
          </Badge>
        </CardHeader>

        <CardContent className="space-y-6 p-6">
          <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-4">
            <div>
              <span className="text-[11px] text-slate-500">Payment date</span>
              <p className="mt-0.5 text-xs font-semibold">
                {new Date(payment.createdAt).toLocaleString('en-PH')}
              </p>
            </div>
            <div>
              <span className="text-[11px] text-slate-500">Student</span>
              <p className="mt-0.5 text-xs font-semibold">
                {payment.studentFirstName} {payment.studentLastName}
              </p>
              <p className="font-mono text-[10px] text-slate-500">{payment.studentNumber}</p>
            </div>
            <div>
              <span className="text-[11px] text-slate-500">Grade and section</span>
              <p className="mt-0.5 text-xs font-semibold">
                {[payment.gradeLevelName, payment.sectionName].filter(Boolean).join(' - ') ||
                  'Not assigned'}
              </p>
            </div>
            <div>
              <span className="text-[11px] text-slate-500">Payment method</span>
              <p className="mt-0.5 text-xs font-semibold">{payment.paymentMethod}</p>
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Stored allocation breakdown
            </h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fee item</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount allocated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payment.allocations.map((allocation) => (
                  <TableRow key={allocation.id}>
                    <TableCell className="text-xs font-medium">{allocation.itemName}</TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {allocation.feeCategoryName}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-bold">
                      {formatCentavos(allocation.amountCentavos)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/40">
            <span className="text-sm font-bold">Total amount received</span>
            <span className="text-2xl font-extrabold text-blue-700 dark:text-blue-300">
              {formatCentavos(payment.amountCentavos)}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-xs dark:border-slate-800">
            <span className="text-slate-500">
              Processed by: {payment.processedByName ?? 'Finance staff'}
            </span>
            <span className="font-semibold text-slate-600 dark:text-slate-300">
              Current student balance: {formatCentavos(payment.remainingBalanceCentavos)}
            </span>
          </div>
          {payment.referenceNumber && (
            <p className="text-xs text-slate-500">Reference: {payment.referenceNumber}</p>
          )}
          {payment.status === 'REVERSED' && (
            <p className="rounded-lg border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700">
              This original payment remains visible for audit history. Its receipt is voided and a
              compensating ledger entry restored the balance.
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={reversalOpen} onOpenChange={setReversalOpen}>
        <DialogHeader>
          <DialogTitle>Reverse payment</DialogTitle>
          <DialogDescription>
            The original payment will remain in history. The server will add a compensating ledger
            entry and void its receipt.
          </DialogDescription>
        </DialogHeader>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          Reason
          <Input
            className="mt-1"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Explain the correction"
            disabled={reverseMutation.isPending}
          />
        </label>
        {reversalError && <p className="mt-3 text-xs text-red-600">{reversalError}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setReversalOpen(false)}>
            Cancel
          </Button>
          <Button
            className="bg-rose-600 text-white hover:bg-rose-700"
            disabled={reverseMutation.isPending}
            onClick={() => reverseMutation.mutate()}
          >
            {reverseMutation.isPending ? 'Reversing…' : 'Confirm reversal'}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
