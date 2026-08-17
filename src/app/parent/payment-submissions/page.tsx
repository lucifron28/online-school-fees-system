'use client';

import Link from 'next/link';
import { Eye, FileImage, Plus, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getClientErrorMessage, requestJson } from '@/lib/client-api';
import type { PortalPaymentSubmission } from '@/lib/portal-types';
import { formatCentavos } from '@/lib/utils/currency';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type SubmissionResponse = {
  items: PortalPaymentSubmission[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};

function statusClass(status: PortalPaymentSubmission['status']) {
  if (status === 'APPROVED') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'REJECTED') return 'border-rose-200 bg-rose-50 text-rose-700';
  return 'border-amber-200 bg-amber-50 text-amber-700';
}

export default function ParentPaymentSubmissionsPage() {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['parent-payment-submissions', page],
    queryFn: () =>
      requestJson<SubmissionResponse>(
        `/api/portal/parent/payment-submissions?page=${page}&pageSize=20`
      ),
  });
  const items = query.data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
            Parent payment proofs
          </Badge>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">Payment proof submissions</h2>
          <p className="text-xs text-slate-500">
            Review the verification status of GCash and Maya proofs submitted for your linked
            children.
          </p>
        </div>
        <Link href="/parent/pay">
          <Button className="h-9 bg-emerald-600 text-xs text-white hover:bg-emerald-700">
            <Plus className="mr-1.5 h-4 w-4" /> Submit another proof
          </Button>
        </Link>
      </div>

      {query.isLoading && <p className="text-sm text-slate-500">Loading submissions…</p>}
      {query.isError && (
        <Card>
          <CardContent className="space-y-3 p-6">
            <p className="text-sm text-rose-600">{getClientErrorMessage(query.error)}</p>
            <Button variant="outline" onClick={() => void query.refetch()}>
              <RefreshCw className="mr-1.5 h-4 w-4" /> Retry
            </Button>
          </CardContent>
        </Card>
      )}
      {query.data && (
        <Card className="shadow-sm">
          <CardContent className="p-0">
            {items.length === 0 ? (
              <div className="space-y-3 p-8 text-center text-sm text-slate-500">
                <p>No payment proof submissions yet.</p>
                <Link href="/parent/pay" className="inline-flex">
                  <Button variant="outline" size="sm" className="text-xs">
                    Submit GCash/Maya proof
                  </Button>
                </Link>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Payment date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead className="text-right">Links</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <p className="text-xs font-semibold">{item.studentName}</p>
                        <p className="font-mono text-[10px] text-slate-500">{item.studentNumber}</p>
                      </TableCell>
                      <TableCell className="text-xs">{item.paymentChannel}</TableCell>
                      <TableCell className="text-xs font-bold">
                        {formatCentavos(item.amountCentavos)}
                      </TableCell>
                      <TableCell className="max-w-36 truncate font-mono text-xs">
                        {item.referenceNumber}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {new Date(item.paidAt).toLocaleString('en-PH')}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${statusClass(item.status)}`}
                        >
                          {item.status.replace('_', ' ')}
                        </Badge>
                        {item.rejectionReason && (
                          <p className="mt-1 max-w-44 text-[10px] text-rose-600">
                            {item.rejectionReason}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {item.paymentDestination
                          ? `${item.paymentDestination.accountName} · ${item.paymentDestination.accountNumber}`
                          : 'Historical destination unavailable'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {item.proofId && (
                            <a
                              href={`/api/portal/parent/payment-submissions/${item.id}/proof`}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`View proof for ${item.studentName}`}
                            >
                              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
                                <FileImage className="h-3.5 w-3.5" />
                              </Button>
                            </a>
                          )}
                          {item.receiptId && (
                            <Link
                              href={`/parent/receipts/${item.receiptId}`}
                              aria-label={`View system-generated receipt for ${item.studentName}`}
                            >
                              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </Link>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {query.data.pageCount > 0 && (
              <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-slate-500">
                <span>
                  Page {query.data.page} of {query.data.pageCount} · {query.data.total} total
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    disabled={page <= 1 || query.isFetching}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    disabled={page >= query.data.pageCount || query.isFetching}
                    onClick={() =>
                      setPage((current) => Math.min(query.data!.pageCount, current + 1))
                    }
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
