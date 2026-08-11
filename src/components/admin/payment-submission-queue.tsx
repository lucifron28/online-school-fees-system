'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, FileImage, RefreshCw, Search, XCircle } from 'lucide-react';
import { getClientErrorMessage, requestJson } from '@/lib/client-api';
import type { PortalPaymentSubmission } from '@/lib/portal-types';
import { formatCentavos } from '@/lib/utils/currency';
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

type SubmissionStatus = PortalPaymentSubmission['status'];

type SubmissionResponse = {
  items: PortalPaymentSubmission[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};

function statusClass(status: SubmissionStatus) {
  if (status === 'APPROVED') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'REJECTED') return 'border-rose-200 bg-rose-50 text-rose-700';
  return 'border-amber-200 bg-amber-50 text-amber-700';
}

export function PaymentSubmissionQueue() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SubmissionStatus | ''>('PENDING_VERIFICATION');
  const [channel, setChannel] = useState<'GCASH' | 'MAYA' | ''>('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ['admin-payment-submissions', status, channel, search],
    queryFn: () => {
      const params = new URLSearchParams({ page: '1', pageSize: '50' });
      if (status) params.set('status', status);
      if (channel) params.set('paymentChannel', channel);
      if (search.trim()) params.set('search', search.trim());
      return requestJson<SubmissionResponse>(`/api/admin/payment-submissions?${params.toString()}`);
    },
  });
  const items = useMemo(() => listQuery.data?.items ?? [], [listQuery.data?.items]);

  useEffect(() => {
    if (!selectedId && items[0]) setSelectedId(items[0].id);
    if (selectedId && !items.some((item) => item.id === selectedId))
      setSelectedId(items[0]?.id ?? null);
  }, [items, selectedId]);

  const detailQuery = useQuery({
    queryKey: ['admin-payment-submission', selectedId],
    enabled: Boolean(selectedId),
    queryFn: () =>
      requestJson<PortalPaymentSubmission>(`/api/admin/payment-submissions/${selectedId}`),
  });
  const selected = detailQuery.data;

  const completeMutation = useMutation({
    mutationFn: async (action: 'approve' | 'reject') => {
      if (!selectedId) throw new Error('Select a payment proof first.');
      return requestJson<PortalPaymentSubmission>(
        `/api/admin/payment-submissions/${selectedId}/${action}`,
        {
          method: 'POST',
          body: action === 'reject' ? JSON.stringify({ reason: rejectionReason }) : undefined,
        }
      );
    },
    onSuccess: (_result, action) => {
      setNotice(
        action === 'approve' ? 'Payment proof approved and posted.' : 'Payment proof rejected.'
      );
      setRequestError(null);
      setRejectionReason('');
      void queryClient.invalidateQueries({ queryKey: ['admin-payment-submissions'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-payment-submission', selectedId] });
    },
    onError: (error) => {
      setNotice(null);
      setRequestError(getClientErrorMessage(error));
    },
  });

  const approve = () => {
    if (!selected || selected.status !== 'PENDING_VERIFICATION') return;
    if (window.confirm('Approve this proof and post the payment to the student ledger?')) {
      completeMutation.mutate('approve');
    }
  };

  const reject = () => {
    if (!selected || selected.status !== 'PENDING_VERIFICATION') return;
    if (!rejectionReason.trim()) {
      setRequestError('Enter a rejection reason before rejecting the proof.');
      return;
    }
    completeMutation.mutate('reject');
  };

  return (
    <div className="max-w-7xl space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
            Finance verification queue
          </Badge>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">GCash and Maya payment proofs</h2>
          <p className="text-xs text-slate-500">
            Review the submitted proof before any payment, ledger, balance, or receipt changes.
          </p>
        </div>
        <Button variant="outline" className="h-9 text-xs" onClick={() => void listQuery.refetch()}>
          <RefreshCw className="mr-1.5 h-4 w-4" /> Refresh queue
        </Button>
      </div>

      {notice && (
        <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {notice}
        </p>
      )}
      {requestError && (
        <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {requestError}
        </p>
      )}

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_0.7fr_0.7fr_auto]">
          <label className="text-xs font-semibold">
            Search student or reference
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                className="pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Student number, name, reference"
              />
            </div>
          </label>
          <label className="text-xs font-semibold">
            Status
            <select
              className="mt-1 flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
              value={status}
              onChange={(event) => setStatus(event.target.value as SubmissionStatus | '')}
            >
              <option value="">All statuses</option>
              <option value="PENDING_VERIFICATION">Pending verification</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </label>
          <label className="text-xs font-semibold">
            Channel
            <select
              className="mt-1 flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
              value={channel}
              onChange={(event) => setChannel(event.target.value as 'GCASH' | 'MAYA' | '')}
            >
              <option value="">All channels</option>
              <option value="GCASH">GCash</option>
              <option value="MAYA">Maya</option>
            </select>
          </label>
          <div className="flex items-end text-xs text-slate-500">
            {listQuery.data?.total ?? 0} result(s)
          </div>
        </CardContent>
      </Card>

      {listQuery.isLoading && <p className="text-sm text-slate-500">Loading verification queue…</p>}
      {listQuery.isError && (
        <Card>
          <CardContent className="space-y-3 p-6">
            <p className="text-sm text-rose-600">{getClientErrorMessage(listQuery.error)}</p>
            <Button variant="outline" onClick={() => void listQuery.refetch()}>
              <RefreshCw className="mr-1.5 h-4 w-4" /> Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {listQuery.data && (
        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.9fr]">
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              {items.length === 0 ? (
                <p className="p-8 text-center text-sm text-slate-500">
                  No matching payment proofs.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow
                        key={item.id}
                        className={selectedId === item.id ? 'bg-blue-50/70' : 'cursor-pointer'}
                        onClick={() => setSelectedId(item.id)}
                      >
                        <TableCell>
                          <p className="text-xs font-semibold">{item.studentName}</p>
                          <p className="font-mono text-[10px] text-slate-500">
                            {item.studentNumber} · {item.referenceNumber}
                          </p>
                        </TableCell>
                        <TableCell className="text-xs">{item.paymentChannel}</TableCell>
                        <TableCell className="text-xs font-bold">
                          {formatCentavos(item.amountCentavos)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${statusClass(item.status)}`}
                          >
                            {item.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Review selected proof</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              {detailQuery.isLoading && <p className="text-slate-500">Loading submission…</p>}
              {detailQuery.isError && (
                <p className="text-rose-600">{getClientErrorMessage(detailQuery.error)}</p>
              )}
              {selected && (
                <>
                  <div className="grid grid-cols-2 gap-3 rounded-lg border bg-slate-50 p-3">
                    <div>
                      <p className="text-slate-500">Student</p>
                      <p className="font-semibold">{selected.studentName}</p>
                      <p className="font-mono text-[10px]">{selected.studentNumber}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Current balance</p>
                      <p className="font-bold text-rose-600">
                        {formatCentavos(selected.currentBalanceCentavos)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Submitter</p>
                      <p className="font-semibold">{selected.submittedByName}</p>
                      <p>{selected.submittedByEmail}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Submitted amount</p>
                      <p className="font-bold">{formatCentavos(selected.amountCentavos)}</p>
                    </div>
                  </div>

                  <div className="space-y-1 rounded-lg border p-3">
                    <p>
                      <span className="text-slate-500">Channel:</span> {selected.paymentChannel}
                    </p>
                    <p>
                      <span className="text-slate-500">Reference:</span> {selected.referenceNumber}
                    </p>
                    <p>
                      <span className="text-slate-500">Paid at:</span>{' '}
                      {new Date(selected.paidAt).toLocaleString('en-PH')}
                    </p>
                    <p>
                      <span className="text-slate-500">Submitted at:</span>{' '}
                      {new Date(selected.createdAt).toLocaleString('en-PH')}
                    </p>
                    {selected.paymentDestination && (
                      <p>
                        <span className="text-slate-500">School destination:</span>{' '}
                        {selected.paymentDestination.accountName} ·{' '}
                        {selected.paymentDestination.accountNumber}
                      </p>
                    )}
                  </div>

                  {selected.proofId ? (
                    <a
                      href={`/api/admin/payment-submissions/${selected.id}/proof`}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-lg border p-2"
                    >
                      {/* The proof endpoint returns a protected, runtime-selected image. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/admin/payment-submissions/${selected.id}/proof`}
                        alt={`Payment proof for ${selected.studentName}`}
                        className="max-h-72 w-full rounded object-contain"
                      />
                      <span className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-blue-700">
                        <FileImage className="h-3.5 w-3.5" /> Open proof in a new tab
                      </span>
                    </a>
                  ) : (
                    <p className="text-rose-600">No proof file is attached.</p>
                  )}

                  {selected.status === 'PENDING_VERIFICATION' ? (
                    <div className="space-y-3 border-t pt-4">
                      <Button
                        className="w-full bg-emerald-600 text-xs text-white hover:bg-emerald-700"
                        onClick={approve}
                        disabled={completeMutation.isPending}
                      >
                        <CheckCircle2 className="mr-1.5 h-4 w-4" /> Approve and post payment
                      </Button>
                      <label className="block font-semibold">
                        Rejection reason (required to reject)
                        <Input
                          className="mt-1"
                          value={rejectionReason}
                          onChange={(event) => setRejectionReason(event.target.value)}
                          placeholder="Explain what the parent should correct"
                        />
                      </label>
                      <Button
                        variant="outline"
                        className="w-full border-rose-300 text-xs text-rose-700"
                        onClick={reject}
                        disabled={completeMutation.isPending}
                      >
                        <XCircle className="mr-1.5 h-4 w-4" /> Reject proof
                      </Button>
                    </div>
                  ) : (
                    <div className={`rounded-lg border p-3 ${statusClass(selected.status)}`}>
                      <p className="font-semibold">{selected.status.replace('_', ' ')}</p>
                      {selected.rejectionReason && (
                        <p className="mt-1">{selected.rejectionReason}</p>
                      )}
                      {selected.receiptNumber && (
                        <p className="mt-1">Receipt: {selected.receiptNumber}</p>
                      )}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
