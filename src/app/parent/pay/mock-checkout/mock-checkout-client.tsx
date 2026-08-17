'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { getClientErrorMessage, requestJson } from '@/lib/client-api';
import type { MockCheckout } from '@/lib/portal-types';
import { formatCentavos } from '@/lib/utils/currency';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Outcome = 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'PENDING';
type CallbackResponse = {
  verificationStatus: 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'PENDING';
  checkoutStatus: string;
  paymentId: string | null;
  isAlreadyProcessed: boolean;
  duplicatePrevented: boolean;
  error?: string;
};

export default function MockCheckoutClient() {
  const searchParams = useSearchParams();
  const reference = searchParams.get('ref') ?? '';
  const queryClient = useQueryClient();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [lastCallback, setLastCallback] = useState<{
    paymentReference: string;
    eventId: string;
    idempotencyKey: string;
    status: Outcome;
  } | null>(null);
  const checkoutQuery = useQuery({
    queryKey: ['parent-checkout', reference],
    enabled: Boolean(reference),
    queryFn: () =>
      requestJson<MockCheckout>(`/api/portal/parent/checkouts/${encodeURIComponent(reference)}`),
  });
  const callbackMutation = useMutation({
    mutationFn: (body: object) =>
      requestJson<CallbackResponse>('/api/payments/mock-callback', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: (result) => {
      setOutcome(result.verificationStatus);
      void queryClient.invalidateQueries({ queryKey: ['parent-checkout', reference] });
      void queryClient.invalidateQueries({ queryKey: ['parent-children'] });
      void queryClient.invalidateQueries({ queryKey: ['parent-payments'] });
    },
  });
  const checkout = checkoutQuery.data;

  const handleOutcome = (status: Outcome, replay = false) => {
    if (!reference) return;
    const callback =
      replay && lastCallback
        ? lastCallback
        : {
            paymentReference: reference,
            eventId: globalThis.crypto.randomUUID(),
            idempotencyKey: globalThis.crypto.randomUUID(),
            status,
          };
    setLastCallback(callback);
    callbackMutation.mutate(callback);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 p-4">
      <Card className="w-full max-w-lg border border-slate-300 bg-white shadow-2xl">
        <CardHeader className="rounded-t-xl bg-slate-900 p-6 text-center text-white">
          <div className="mb-2 flex justify-center">
            <ShieldCheck className="h-8 w-8 text-emerald-400" />
          </div>
          <Badge
            variant="outline"
            className="mx-auto mb-1 border-slate-700 bg-slate-800 text-slate-300"
          >
            SIMULATED ONLINE PAYMENT GATEWAY
          </Badge>
          <CardTitle className="text-xl font-bold">Server-verified checkout</CardTitle>
          <p className="text-xs text-slate-400">Fictional sandbox demonstration</p>
        </CardHeader>

        <CardContent className="space-y-6 p-6">
          {!reference && <p className="text-sm text-rose-600">A checkout reference is required.</p>}
          {checkoutQuery.isLoading && (
            <p className="text-sm text-slate-500">Loading persisted checkout…</p>
          )}
          {checkoutQuery.isError && (
            <div className="space-y-3">
              <p className="text-sm text-rose-600">{getClientErrorMessage(checkoutQuery.error)}</p>
              <Button variant="outline" onClick={() => void checkoutQuery.refetch()}>
                <RefreshCw className="mr-1.5 h-4 w-4" /> Retry
              </Button>
            </div>
          )}

          {checkout && (
            <>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                <span className="font-mono text-xs text-slate-500">Checkout reference</span>
                <p className="break-all font-mono text-sm font-bold text-slate-900">
                  {checkout.paymentReference}
                </p>
                <div className="mt-3 border-t border-slate-200 pt-3">
                  <span className="text-xs font-semibold text-slate-500">Amount</span>
                  <p className="mt-1 text-3xl font-extrabold text-emerald-600">
                    {formatCentavos(checkout.amountCentavos)}
                  </p>
                </div>
              </div>

              {checkout.status === 'CREATED' && !outcome && (
                <div className="space-y-3">
                  <p className="text-center text-xs font-medium text-slate-600">
                    Choose a gateway callback outcome. The browser cannot post the ledger directly.
                  </p>
                  <Button
                    disabled={callbackMutation.isPending}
                    onClick={() => handleOutcome('SUCCESS')}
                    className="h-10 w-full bg-emerald-600 text-xs text-white hover:bg-emerald-700"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Simulate successful callback
                  </Button>
                  <Button
                    disabled={callbackMutation.isPending}
                    variant="outline"
                    onClick={() => handleOutcome('PENDING')}
                    className="h-9 w-full text-xs"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" /> Simulate delayed confirmation
                  </Button>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      disabled={callbackMutation.isPending}
                      variant="outline"
                      onClick={() => handleOutcome('FAILED')}
                      className="h-9 border-rose-300 text-xs text-rose-700"
                    >
                      <XCircle className="mr-1.5 h-4 w-4" /> Failure
                    </Button>
                    <Button
                      disabled={callbackMutation.isPending}
                      variant="outline"
                      onClick={() => handleOutcome('CANCELLED')}
                      className="h-9 text-xs"
                    >
                      <AlertCircle className="mr-1.5 h-4 w-4" /> Cancel
                    </Button>
                  </div>
                </div>
              )}

              {callbackMutation.isPending && (
                <p className="text-center text-xs font-semibold text-slate-600">
                  Processing server callback…
                </p>
              )}
              {callbackMutation.isError && (
                <p className="text-center text-xs text-rose-600">
                  {getClientErrorMessage(callbackMutation.error)}
                </p>
              )}
              {outcome && !callbackMutation.isPending && (
                <div className="space-y-3 rounded-xl border border-slate-200 p-4 text-center">
                  <p className="text-sm font-bold">Callback result: {outcome}</p>
                  <p className="text-xs text-slate-500">
                    Refreshing this page reads the persisted checkout state from PostgreSQL.
                  </p>
                  {lastCallback && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOutcome(outcome, true)}
                    >
                      Replay same callback (idempotency test)
                    </Button>
                  )}
                  <Link href="/parent/history">
                    <Button className="ml-2 bg-emerald-600 text-xs text-white hover:bg-emerald-700">
                      View payment history
                    </Button>
                  </Link>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
