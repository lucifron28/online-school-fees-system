'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Building2, Download, RefreshCw } from 'lucide-react';
import { getClientErrorMessage, requestJson } from '@/lib/client-api';
import type { PortalPayment } from '@/lib/portal-types';
import { formatCentavos } from '@/lib/utils/currency';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function ParentReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const paymentsQuery = useQuery({
    queryKey: ['parent-payments'],
    queryFn: () => requestJson<PortalPayment[]>('/api/portal/parent/payments'),
  });
  const payment = paymentsQuery.data?.find(
    (candidate) => candidate.receiptId === id || candidate.receiptNumber === id
  );
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/parent/history">
            <Button variant="outline" size="sm" className="h-9 px-3 text-xs">
              <ArrowLeft className="mr-1 h-4 w-4" /> History
            </Button>
          </Link>
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
            Payment acknowledgment receipt
          </Badge>
        </div>
        <a
          href={`/api/portal/receipts/${encodeURIComponent(id)}/pdf`}
          target="_blank"
          rel="noreferrer"
        >
          <Button className="h-9 bg-emerald-600 text-xs text-white hover:bg-emerald-700">
            <Download className="mr-1.5 h-4 w-4" /> Download PDF
          </Button>
        </a>
      </div>

      {paymentsQuery.isLoading && <p className="text-sm text-slate-500">Loading stored receipt…</p>}
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
      {paymentsQuery.data && !payment && (
        <Card>
          <CardContent className="p-8 text-center text-sm text-slate-500">
            This receipt is not linked to a payment you own.
          </CardContent>
        </Card>
      )}
      {payment && (
        <Card className="border border-slate-300 bg-white shadow-lg">
          <CardContent className="space-y-6 p-8">
            <div className="border-b pb-6 text-center">
              <div className="mb-2 flex justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-white">
                  <Building2 className="h-6 w-6" />
                </div>
              </div>
              <h2 className="text-lg font-bold uppercase tracking-wider">
                Payment acknowledgment receipt
              </h2>
              <p className="text-xs text-slate-500">Online School Fees Monitoring System</p>
              <Badge variant="outline" className="mt-2">
                {payment.receiptStatus ?? 'ACTIVE'}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400">Receipt no.</span>
                <p className="font-mono font-bold">{payment.receiptNumber}</p>
              </div>
              <div>
                <span className="text-slate-400">Date</span>
                <p className="font-semibold">
                  {new Date(payment.createdAt).toLocaleString('en-PH')}
                </p>
              </div>
              <div>
                <span className="text-slate-400">Student</span>
                <p className="font-semibold">{payment.studentName}</p>
              </div>
              <div>
                <span className="text-slate-400">Payment method</span>
                <p className="font-semibold">{payment.paymentMethod}</p>
              </div>
              <div>
                <span className="text-slate-400">Reference</span>
                <p className="font-mono font-semibold">
                  {payment.referenceNumber ?? 'Not available'}
                </p>
              </div>
              <div>
                <span className="text-slate-400">Transaction status</span>
                <p className="font-semibold">{payment.status}</p>
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between text-sm font-bold">
                <span>Amount received</span>
                <span className="text-lg text-emerald-700">
                  {formatCentavos(payment.amountCentavos)}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between border-t pt-3 text-xs">
                <span className="text-slate-500">Remaining Balance After Payment</span>
                <span className="font-mono font-semibold">
                  {payment.balanceAfterPaymentCentavos === null
                    ? 'Unavailable for legacy receipt'
                    : formatCentavos(payment.balanceAfterPaymentCentavos)}
                </span>
              </div>
              {payment.allocations.length > 0 && (
                <div className="mt-4 border-t pt-3">
                  <p className="text-xs font-semibold text-slate-600">Allocation breakdown</p>
                  <div className="mt-2 space-y-1">
                    {payment.allocations.map((allocation, index) => (
                      <div
                        key={`${allocation.targetType}-${allocation.name}-${index}`}
                        className="flex justify-between gap-3 text-xs"
                      >
                        <span>
                          {allocation.targetType === 'DEBIT_ADJUSTMENT' ? 'Debit adjustment: ' : ''}
                          {allocation.name}
                        </span>
                        <span className="font-mono font-semibold">
                          {formatCentavos(allocation.amountCentavos)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t pt-4 text-center text-[10px] text-slate-400">
              This fictional demonstration receipt is generated from persisted payment data.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
