'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, CreditCard, RefreshCw, Smartphone, Wallet } from 'lucide-react';
import { getClientErrorMessage, requestJson } from '@/lib/client-api';
import { portalCheckoutInputSchema } from '@/lib/portal';
import type { MockCheckoutResult, PortalChild } from '@/lib/portal-types';
import { formatCentavos, parseMoneyInput } from '@/lib/utils/currency';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function ParentPayPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedStudentId, setSelectedStudentId] = useState(searchParams.get('studentId') ?? '');
  const [paymentChannel, setPaymentChannel] = useState<'GCash' | 'Maya' | 'CreditCard'>('GCash');
  const [amount, setAmount] = useState('');
  const [formError, setFormError] = useState('');

  const childrenQuery = useQuery({
    queryKey: ['parent-children'],
    queryFn: () => requestJson<PortalChild[]>('/api/portal/parent/children'),
  });
  const children = useMemo(() => childrenQuery.data ?? [], [childrenQuery.data]);
  const selectedChild = children.find((child) => child.studentId === selectedStudentId);

  useEffect(() => {
    if (!selectedStudentId && children[0]) setSelectedStudentId(children[0].studentId);
  }, [children, selectedStudentId]);

  const checkoutMutation = useMutation({
    mutationFn: (input: unknown) =>
      requestJson<MockCheckoutResult>('/api/portal/parent/checkouts', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (result) => router.push(result.redirectUrl),
  });

  const handleProceed = (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');
    if (!selectedChild) {
      setFormError('Select a linked child.');
      return;
    }
    try {
      const parsed = portalCheckoutInputSchema.parse({
        studentId: selectedChild.studentId,
        amountCentavos: parseMoneyInput(amount),
        paymentChannel,
        idempotencyKey: globalThis.crypto.randomUUID(),
      });
      checkoutMutation.mutate(parsed);
    } catch (error) {
      setFormError(getClientErrorMessage(error));
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/parent/dashboard">
          <Button variant="outline" size="sm" className="h-9 px-3 text-xs">
            <ArrowLeft className="mr-1 h-4 w-4" /> Dashboard
          </Button>
        </Link>
        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
          Mock online payment
        </Badge>
      </div>

      <div>
        <h2 className="text-2xl font-bold tracking-tight">Start a mock online payment</h2>
        <p className="text-xs text-slate-500">
          The checkout is persisted server-side; only the simulated gateway callback can complete
          it.
        </p>
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
            No linked children are available for payment.
          </CardContent>
        </Card>
      )}

      {children.length > 0 && (
        <form onSubmit={handleProceed} className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Payment details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <label className="block text-xs font-semibold">
                Linked child
                <select
                  className="mt-1 flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                  value={selectedStudentId}
                  onChange={(event) => setSelectedStudentId(event.target.value)}
                >
                  {children.map((child) => (
                    <option key={child.studentId} value={child.studentId}>
                      {child.firstName} {child.lastName} ({child.studentNumber})
                    </option>
                  ))}
                </select>
              </label>

              <div>
                <p className="mb-3 text-xs font-semibold">Payment channel</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {(
                    [
                      ['GCash', Smartphone, 'text-blue-600'],
                      ['Maya', Wallet, 'text-emerald-600'],
                      ['CreditCard', CreditCard, 'text-purple-600'],
                    ] as const
                  ).map(([channel, Icon, iconClass]) => (
                    <button
                      key={channel}
                      type="button"
                      onClick={() => setPaymentChannel(channel)}
                      className={`flex flex-col items-center justify-center rounded-xl border p-4 text-center ${
                        paymentChannel === channel
                          ? 'border-emerald-600 bg-emerald-50 font-bold ring-2 ring-emerald-500/20'
                          : 'border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      <Icon className={`mb-2 h-6 w-6 ${iconClass}`} />
                      <span className="text-xs font-semibold">
                        {channel === 'CreditCard' ? 'Credit / Debit card' : channel}
                      </span>
                      <span className="text-[10px] text-slate-400">Simulation only</span>
                    </button>
                  ))}
                </div>
              </div>

              <label className="block text-xs font-semibold">
                Amount to pay (PHP)
                <Input
                  className="mt-1 h-10"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder={
                    selectedChild
                      ? formatCentavos(selectedChild.outstandingBalanceCentavos)
                      : '0.00'
                  }
                  inputMode="decimal"
                />
              </label>
              {formError && <p className="text-xs text-rose-600">{formError}</p>}
              {checkoutMutation.isError && (
                <p className="text-xs text-rose-600">
                  {getClientErrorMessage(checkoutMutation.error)}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="flex flex-col justify-between">
            <div>
              <CardHeader className="border-b">
                <CardTitle className="text-base">Server checkout</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-4 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Current balance</span>
                  <span className="font-bold text-rose-600">
                    {formatCentavos(selectedChild?.outstandingBalanceCentavos ?? 0)}
                  </span>
                </div>
                <p className="text-slate-500">
                  The server rechecks ownership, amount, assessment balance, and idempotency before
                  creating the checkout.
                </p>
              </CardContent>
            </div>
            <div className="rounded-b-xl border-t bg-slate-50 p-4">
              <Button
                type="submit"
                disabled={checkoutMutation.isPending}
                className="h-10 w-full bg-emerald-600 text-xs text-white hover:bg-emerald-700"
              >
                {checkoutMutation.isPending ? 'Creating checkout…' : 'Proceed to simulated gateway'}
                {!checkoutMutation.isPending && <ArrowRight className="ml-1.5 h-4 w-4" />}
              </Button>
            </div>
          </Card>
        </form>
      )}
    </div>
  );
}
