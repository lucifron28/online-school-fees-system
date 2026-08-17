'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useForm, useStore } from '@tanstack/react-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, RefreshCw, Send, Smartphone, Wallet } from 'lucide-react';
import { getClientErrorMessage, requestJson } from '@/lib/client-api';
import type {
  PaymentDestinationOptions,
  PortalChild,
  PortalPaymentSubmission,
} from '@/lib/portal-types';
import { formatCentavos, parseMoneyInput } from '@/lib/utils/currency';
import { paymentBalanceAmountClass } from '@/lib/deadlines';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ImageUploadField, MAX_FILE_SIZE } from '@/components/ui/image-upload-field';

type PaymentChannel = 'GCASH' | 'MAYA';

async function requestForm<T>(input: RequestInfo, body: FormData): Promise<T> {
  const response = await fetch(input, { method: 'POST', body });
  const payload = (await response.json().catch(() => null)) as { error?: string } | T | null;
  if (!response.ok) {
    throw new Error(
      typeof payload === 'object' && payload && 'error' in payload && payload.error
        ? payload.error
        : `Request failed with status ${response.status}.`
    );
  }
  return payload as T;
}

function destinationFor(options: PaymentDestinationOptions | undefined, channel: PaymentChannel) {
  return channel === 'GCASH' ? (options?.gcash ?? null) : (options?.maya ?? null);
}

export default function ParentPayPage() {
  const searchParams = useSearchParams();
  const initialStudentId = searchParams.get('studentId') ?? '';
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [formError, setFormError] = useState('');
  const [successSubmission, setSuccessSubmission] = useState<PortalPaymentSubmission | null>(null);

  const childrenQuery = useQuery({
    queryKey: ['parent-children'],
    queryFn: () => requestJson<PortalChild[]>('/api/portal/parent/children'),
  });
  const optionsQuery = useQuery({
    queryKey: ['parent-payment-options'],
    queryFn: () =>
      requestJson<PaymentDestinationOptions>('/api/portal/parent/payment-submissions/options'),
  });
  const children = useMemo(() => childrenQuery.data ?? [], [childrenQuery.data]);

  useEffect(() => {
    if (!proofFile) {
      setProofPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(proofFile);
    setProofPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [proofFile]);

  const form = useForm({
    defaultValues: {
      studentId: initialStudentId,
      paymentChannel: 'GCASH' as PaymentChannel,
      amount: '',
      referenceNumber: '',
      paidAt: '',
    },
    onSubmit: async ({ value }) => {
      setFormError('');
      const submittedChild = children.find((child) => child.studentId === value.studentId);
      const submittedDestination = destinationFor(optionsQuery.data, value.paymentChannel);
      if (!submittedChild) {
        setFormError('Select a linked child.');
        return;
      }
      if (!submittedDestination) {
        setFormError('This payment channel is not currently configured by the school.');
        return;
      }
      if (!proofFile) {
        setFormError('Upload a JPEG, PNG, or WebP screenshot of the payment.');
        return;
      }

      try {
        const amountCentavos = parseMoneyInput(value.amount);
        const paidAt = new Date(value.paidAt);
        if (!Number.isFinite(paidAt.getTime())) throw new Error('Enter the payment date and time.');
        const body = new FormData();
        body.set('studentId', value.studentId);
        body.set('paymentChannel', value.paymentChannel);
        body.set('amountCentavos', String(amountCentavos));
        body.set('referenceNumber', value.referenceNumber);
        body.set('paidAt', paidAt.toISOString());
        body.set('idempotencyKey', globalThis.crypto.randomUUID());
        body.set('proof', proofFile);
        submissionMutation.mutate(body);
      } catch (error) {
        setFormError(getClientErrorMessage(error));
      }
    },
  });

  const formValues = useStore(form.store, (state) => state.values);
  const selectedChild = children.find((child) => child.studentId === formValues.studentId);
  const destination = destinationFor(optionsQuery.data, formValues.paymentChannel);

  useEffect(() => {
    const firstStudentId = children[0]?.studentId;
    if (firstStudentId && !children.some((child) => child.studentId === formValues.studentId)) {
      form.setFieldValue('studentId', firstStudentId);
    }
  }, [children, form, formValues.studentId]);

  useEffect(() => {
    if (!optionsQuery.data || destination) return;
    const fallbackChannel: PaymentChannel | null = optionsQuery.data.gcash
      ? 'GCASH'
      : optionsQuery.data.maya
        ? 'MAYA'
        : null;
    if (fallbackChannel) form.setFieldValue('paymentChannel', fallbackChannel);
  }, [destination, form, formValues.paymentChannel, optionsQuery.data]);

  const submissionMutation = useMutation({
    mutationFn: (body: FormData) =>
      requestForm<PortalPaymentSubmission>('/api/portal/parent/payment-submissions', body),
    onSuccess: (submission) => {
      setSuccessSubmission(submission);
      setFormError('');
      setProofFile(null);
      setFileInputKey((value) => value + 1);
      const resetStudentId = children[0]?.studentId ?? initialStudentId;
      const resetChannel: PaymentChannel = optionsQuery.data?.gcash
        ? 'GCASH'
        : optionsQuery.data?.maya
          ? 'MAYA'
          : 'GCASH';
      form.reset({
        studentId: resetStudentId,
        paymentChannel: resetChannel,
        amount: '',
        referenceNumber: '',
        paidAt: '',
      });
    },
  });

  const handleProofChange = (file: File | null) => {
    if (!file) {
      setProofFile(null);
      return;
    }
    const acceptedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!acceptedTypes.has(file.type)) {
      setProofFile(null);
      setFileInputKey((value) => value + 1);
      setFormError('Choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size < 1 || file.size > MAX_FILE_SIZE) {
      setProofFile(null);
      setFileInputKey((value) => value + 1);
      setFormError('The payment screenshot must be smaller than 3 MB.');
      return;
    }
    setFormError('');
    setProofFile(file);
  };

  const submitDisabled =
    submissionMutation.isPending ||
    !selectedChild ||
    !destination ||
    !proofFile ||
    selectedChild.outstandingBalanceCentavos <= 0;

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/parent/dashboard">
          <Button variant="outline" size="sm" className="h-9 px-3 text-xs">
            <ArrowLeft className="mr-1 h-4 w-4" /> Dashboard
          </Button>
        </Link>
        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
          Manual verification
        </Badge>
      </div>

      <div>
        <h2 className="text-2xl font-bold tracking-tight">Submit GCash or Maya payment proof</h2>
        <p className="max-w-3xl text-xs text-slate-500">
          The money transfer happens outside this system using GCash or Maya. Submit your payment
          details and screenshot here for school verification. Uploading proof does not change the
          balance until Finance Staff approves it.
        </p>
      </div>

      {childrenQuery.isLoading && (
        <p className="text-sm text-slate-500">Loading linked children…</p>
      )}
      {(childrenQuery.isError || optionsQuery.isError) && (
        <Card>
          <CardContent className="space-y-3 p-6">
            <p className="text-sm text-rose-600">
              {getClientErrorMessage(childrenQuery.error ?? optionsQuery.error)}
            </p>
            <Button
              variant="outline"
              onClick={() => {
                void childrenQuery.refetch();
                void optionsQuery.refetch();
              }}
            >
              <RefreshCw className="mr-1.5 h-4 w-4" /> Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {childrenQuery.data && children.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-sm text-slate-500">
            No linked children are available for payment proof submission.
          </CardContent>
        </Card>
      )}

      {children.length > 0 && (
        <form
          className="grid gap-6 lg:grid-cols-[1.45fr_0.85fr]"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment proof details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <form.Field name="studentId">
                {(field) => (
                  <label className="block text-xs font-semibold">
                    Linked child
                    <select
                      className="mt-1 flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                    >
                      {children.map((child) => (
                        <option key={child.studentId} value={child.studentId}>
                          {child.firstName} {child.lastName} ({child.studentNumber})
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </form.Field>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Authoritative current balance
                </p>
                <p
                  className={`mt-1 text-2xl font-extrabold ${paymentBalanceAmountClass(selectedChild?.outstandingBalanceCentavos === 0 ? 'PAID' : 'WITH_REMAINING_BALANCE')}`}
                >
                  {formatCentavos(selectedChild?.outstandingBalanceCentavos ?? 0)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {selectedChild?.outstandingBalanceCentavos
                    ? 'The school rechecks this balance when reviewing your proof.'
                    : 'There is no outstanding balance for this child.'}
                </p>
              </div>

              <form.Field name="paymentChannel">
                {(field) => (
                  <div>
                    <p className="mb-3 text-xs font-semibold">Payment channel</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {(
                        [
                          ['GCASH', Smartphone, 'text-blue-600', optionsQuery.data?.gcash],
                          ['MAYA', Wallet, 'text-emerald-600', optionsQuery.data?.maya],
                        ] as const
                      ).map(([channel, Icon, iconClass, account]) => (
                        <button
                          key={channel}
                          type="button"
                          disabled={!account}
                          aria-pressed={field.state.value === channel}
                          onClick={() => field.handleChange(channel)}
                          className={`flex items-center gap-3 rounded-xl border p-4 text-left ${
                            field.state.value === channel
                              ? 'border-emerald-600 bg-emerald-50 font-bold ring-2 ring-emerald-500/20'
                              : 'border-slate-200 bg-white text-slate-700'
                          } ${!account ? 'cursor-not-allowed opacity-45' : ''}`}
                        >
                          <Icon className={`h-6 w-6 ${iconClass}`} />
                          <span>
                            <span className="block text-xs font-semibold">{channel}</span>
                            <span className="block text-[10px] text-slate-400">
                              {account ? 'Configured school destination' : 'Not enabled'}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </form.Field>

              {destination && (
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-xs text-blue-900">
                  <p className="font-semibold">
                    Transfer to the school {formValues.paymentChannel} account
                  </p>
                  <p className="mt-2">Account name: {destination.accountName}</p>
                  <p>Account number: {destination.accountNumber}</p>
                  <p className="mt-2 text-blue-700">
                    Complete the transfer in the external {formValues.paymentChannel} app. This
                    system does not initiate or automatically verify the transfer.
                  </p>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <form.Field name="amount">
                  {(field) => (
                    <label className="block text-xs font-semibold">
                      Amount transferred (PHP)
                      <Input
                        className="mt-1"
                        value={field.state.value}
                        onChange={(event) => field.handleChange(event.target.value)}
                        placeholder="0.00"
                        inputMode="decimal"
                        required
                      />
                    </label>
                  )}
                </form.Field>
                <form.Field name="referenceNumber">
                  {(field) => (
                    <label className="block text-xs font-semibold">
                      Transaction/reference number
                      <Input
                        className="mt-1"
                        value={field.state.value}
                        onChange={(event) => field.handleChange(event.target.value)}
                        placeholder="e.g. DEMO-2026-001"
                        required
                      />
                    </label>
                  )}
                </form.Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <form.Field name="paidAt">
                  {(field) => (
                    <label className="block text-xs font-semibold">
                      Transaction date and time
                      <Input
                        className="mt-1"
                        type="datetime-local"
                        value={field.state.value}
                        onChange={(event) => field.handleChange(event.target.value)}
                        required
                      />
                    </label>
                  )}
                </form.Field>
                <ImageUploadField
                  id="payment-proof-upload"
                  label="Payment screenshot"
                  file={proofFile}
                  previewUrl={proofPreviewUrl}
                  inputKey={fileInputKey}
                  error={
                    formError.startsWith('Choose a JPEG') ||
                    formError.startsWith('The payment screenshot')
                      ? formError
                      : undefined
                  }
                  onChange={handleProofChange}
                  onRemove={() => {
                    setProofFile(null);
                    setFileInputKey((value) => value + 1);
                    setFormError('');
                  }}
                />
              </div>

              {formError && <p className="text-xs text-rose-600">{formError}</p>}
              {submissionMutation.isError && (
                <p className="text-xs text-rose-600">
                  {getClientErrorMessage(submissionMutation.error)}
                </p>
              )}

              <Button
                type="submit"
                disabled={submitDisabled}
                className="h-10 w-full bg-emerald-600 text-xs text-white hover:bg-emerald-700"
              >
                <Send className="mr-1.5 h-4 w-4" />
                {submissionMutation.isPending ? 'Submitting for review…' : 'Submit payment proof'}
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">What happens next?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs text-slate-600">
                <p>1. Complete the transfer in the external GCash or Maya app.</p>
                <p>2. Submit the reference, timestamp, amount, and screenshot here.</p>
                <p>3. Finance Staff reviews the proof and either approves or rejects it.</p>
                <p>4. Only approval posts the payment, receipt, and balance update.</p>
              </CardContent>
            </Card>

            {successSubmission && (
              <Card className="border-emerald-200 bg-emerald-50/70">
                <CardContent className="space-y-3 p-5 text-sm text-emerald-900">
                  <p className="flex items-center gap-2 font-semibold">
                    <CheckCircle2 className="h-5 w-5" /> PENDING VERIFICATION
                  </p>
                  <p className="text-xs">
                    Your proof was saved. The balance will remain unchanged until Finance Staff
                    approves it.
                  </p>
                  <Link href="/parent/payment-submissions">
                    <Button variant="outline" className="h-9 text-xs">
                      View submission history
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
