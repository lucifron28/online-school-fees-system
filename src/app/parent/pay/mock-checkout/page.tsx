'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ImagePlaceholder } from '@/components/ui/image-placeholder';
import { CheckCircle2, XCircle, AlertCircle, ArrowLeft, ShieldCheck } from 'lucide-react';
import { MockPaymentGateway } from '@/server/services/payment-gateway.service';
import { formatCentavos } from '@/lib/utils/currency';

export default function MockCheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const ref = searchParams.get('ref') || 'PAY-ONLINE-123456';
  const amountParam = parseInt(searchParams.get('amt') || '1400000', 10);
  const channel = searchParams.get('channel') || 'GCash';

  const [status, setStatus] = useState<'IDLE' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'CANCELLED'>(
    'IDLE'
  );
  const [isReplay, setIsReplay] = useState(false);

  const handleOutcome = (outcome: 'SUCCESS' | 'FAILED' | 'CANCELLED') => {
    setStatus('PROCESSING');

    setTimeout(() => {
      const result = MockPaymentGateway.processCallback(ref, outcome, amountParam, 'std-001');
      if (result.isAlreadyProcessed) {
        setIsReplay(true);
      }

      setStatus(outcome);

      if (outcome === 'SUCCESS') {
        setTimeout(() => {
          router.push(`/parent/receipts/OR-2024-000123?ref=${ref}`);
        }, 1500);
      }
    }, 800);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 p-4 dark:bg-slate-950">
      <Card className="w-full max-w-lg border border-slate-300 bg-white shadow-2xl dark:bg-slate-900">
        {/* Header */}
        <CardHeader className="relative rounded-t-xl bg-slate-900 p-6 text-center text-white">
          <div className="mb-2 flex justify-center">
            <ShieldCheck className="h-8 w-8 text-emerald-400" />
          </div>
          <Badge
            variant="outline"
            className="mx-auto mb-1 border-slate-700 bg-slate-800 text-slate-300"
          >
            SIMULATED ONLINE PAYMENT GATEWAY
          </Badge>
          <CardTitle className="text-xl font-bold">{channel} Online Checkout</CardTitle>
          <p className="text-xs text-slate-400">Sandbox Environment • Capstone Demonstration</p>
        </CardHeader>

        <CardContent className="space-y-6 p-6">
          {/* Amount Box */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center dark:border-slate-700 dark:bg-slate-800">
            <span className="font-mono text-xs text-slate-500">Payment Reference</span>
            <p className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">{ref}</p>

            <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-700">
              <span className="text-xs font-semibold text-slate-500">Amount to Pay</span>
              <p className="mt-1 text-3xl font-extrabold text-emerald-600">
                {formatCentavos(amountParam)}
              </p>
            </div>
          </div>

          {/* Outcome Simulation Actions */}
          {status === 'IDLE' && (
            <div className="space-y-3">
              <p className="mb-2 text-center text-xs font-medium text-slate-600 dark:text-slate-400">
                Simulate Payment Gateway Outcome:
              </p>

              <Button
                onClick={() => handleOutcome('SUCCESS')}
                className="h-10 w-full bg-emerald-600 text-xs font-semibold text-white shadow-md hover:bg-emerald-700"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                <span>Simulate Successful Payment</span>
              </Button>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => handleOutcome('FAILED')}
                  variant="outline"
                  className="h-9 border-rose-300 text-xs text-rose-700 hover:bg-rose-50"
                >
                  <XCircle className="mr-1.5 h-4 w-4" />
                  <span>Simulate Failure</span>
                </Button>

                <Button
                  onClick={() => handleOutcome('CANCELLED')}
                  variant="outline"
                  className="h-9 border-slate-300 text-xs text-slate-700 hover:bg-slate-100"
                >
                  <AlertCircle className="mr-1.5 h-4 w-4" />
                  <span>Cancel Payment</span>
                </Button>
              </div>
            </div>
          )}

          {/* Processing Indicator */}
          {status === 'PROCESSING' && (
            <div className="space-y-2 py-6 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
              <p className="text-xs font-semibold text-slate-700">
                Processing server verification...
              </p>
            </div>
          )}

          {/* Success Result */}
          {status === 'SUCCESS' && (
            <div className="space-y-3 py-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Payment Verification Successful!
              </h3>
              {isReplay && (
                <Badge
                  variant="outline"
                  className="border-amber-200 bg-amber-50 text-[10px] text-amber-700"
                >
                  Idempotent Replay Detected (No Duplicate Payment Created)
                </Badge>
              )}
              <p className="text-xs text-slate-500">Redirecting to official receipt...</p>
            </div>
          )}

          {/* Failure Result */}
          {status === 'FAILED' && (
            <div className="space-y-3 py-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <XCircle className="h-7 w-7" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Payment Failed</h3>
              <p className="text-xs text-slate-500">
                The gateway declined the transaction. Your ledger remains unchanged.
              </p>
              <Link href="/parent/pay">
                <Button variant="outline" className="mt-2 h-9 text-xs">
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  <span>Back to Payment Page</span>
                </Button>
              </Link>
            </div>
          )}

          {/* Cancelled Result */}
          {status === 'CANCELLED' && (
            <div className="space-y-3 py-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                <AlertCircle className="h-7 w-7" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Payment Cancelled</h3>
              <p className="text-xs text-slate-500">You cancelled the online checkout session.</p>
              <Link href="/parent/pay">
                <Button variant="outline" className="mt-2 h-9 text-xs">
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  <span>Return to Portal</span>
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
