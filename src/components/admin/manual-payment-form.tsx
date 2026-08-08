'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from '@tanstack/react-form';
import { otcPaymentPostInputSchema } from '@/lib/payments';
import { getClientErrorMessage, requestJson } from '@/lib/client-api';
import { formatCentavos, parseMoneyInput } from '@/lib/utils/currency';
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
import { RefreshCw } from 'lucide-react';

type StudentRow = {
  id: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  gradeLevelName: string | null;
  sectionName: string | null;
  schoolYearName: string | null;
  status: string;
};

type StudentListResponse = {
  data: StudentRow[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

type AssessmentResponse = {
  ledger: { balanceCentavos: number };
};

type PaymentResponse = {
  id: string;
  amountCentavos: number;
  status: string;
  receipt: {
    id: string;
    receiptNumber: string;
    verificationIdentifier: string;
    status: string;
  } | null;
};

type ManualPaymentValues = {
  studentId: string;
  amount: string;
  paymentMethod: 'CASH' | 'BANK_DEPOSIT';
  referenceNumber: string;
};

export function ManualPaymentForm() {
  const queryClient = useQueryClient();
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [formError, setFormError] = useState('');
  const [successPayment, setSuccessPayment] = useState<PaymentResponse | null>(null);

  const studentsQuery = useQuery({
    queryKey: ['admin-payment-students'],
    queryFn: () =>
      requestJson<StudentListResponse>('/api/admin/students?page=1&pageSize=100&status=ACTIVE'),
  });
  const assessmentQuery = useQuery({
    queryKey: ['admin-payment-student-balance', selectedStudentId],
    enabled: Boolean(selectedStudentId),
    queryFn: () =>
      requestJson<AssessmentResponse>(`/api/admin/students/${selectedStudentId}/assessments`),
  });

  const form = useForm({
    defaultValues: {
      studentId: '',
      amount: '',
      paymentMethod: 'CASH' as ManualPaymentValues['paymentMethod'],
      referenceNumber: '',
    },
    onSubmit: async ({ value }) => {
      setFormError('');
      let amountCentavos: number;
      try {
        amountCentavos = parseMoneyInput(value.amount);
      } catch (error) {
        setFormError(getClientErrorMessage(error));
        return;
      }

      const parsed = otcPaymentPostInputSchema.safeParse({
        studentId: value.studentId,
        amountCentavos,
        paymentMethod: value.paymentMethod,
        referenceNumber: value.referenceNumber || undefined,
        idempotencyKey: globalThis.crypto.randomUUID(),
      });
      if (!parsed.success) {
        setFormError('Select a student and enter a positive payment amount.');
        return;
      }

      try {
        const payment = await requestJson<PaymentResponse>('/api/admin/payments', {
          method: 'POST',
          body: JSON.stringify(parsed.data),
        });
        setSuccessPayment(payment);
        form.reset();
        setSelectedStudentId('');
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['admin-payment-students'] }),
          queryClient.invalidateQueries({ queryKey: ['admin-payments'] }),
        ]);
      } catch (error) {
        setFormError(getClientErrorMessage(error));
      }
    },
  });

  const selectedStudent = (studentsQuery.data?.data ?? []).find(
    (student) => student.id === selectedStudentId
  );
  const balanceCentavos = assessmentQuery.data?.ledger.balanceCentavos ?? 0;

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
          Finance · OTC payment
        </Badge>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Over-the-counter payment processing
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Record a cash or bank-deposit payment against the persisted student ledger.
        </p>
      </div>

      <Card className="border-slate-200 shadow-sm dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-base">Payment details</CardTitle>
        </CardHeader>
        <CardContent>
          {studentsQuery.isLoading && (
            <p className="text-sm text-slate-500">Loading active students…</p>
          )}
          {studentsQuery.isError && (
            <div>
              <p className="text-sm text-red-600">{getClientErrorMessage(studentsQuery.error)}</p>
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => void studentsQuery.refetch()}
              >
                <RefreshCw className="mr-1 h-3.5 w-3.5" /> Retry
              </Button>
            </div>
          )}
          {studentsQuery.data && (
            <form
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void form.handleSubmit();
              }}
            >
              <form.Field name="studentId">
                {(field) => (
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Student
                    <select
                      className="mt-1 flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:border-slate-800 dark:bg-slate-950"
                      value={field.state.value}
                      onChange={(event) => {
                        const value = event.target.value;
                        field.handleChange(value);
                        setSelectedStudentId(value);
                      }}
                    >
                      <option value="">Select an active student</option>
                      {studentsQuery.data.data.map((student) => (
                        <option key={student.id} value={student.id}>
                          {student.studentNumber} — {student.firstName} {student.lastName}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </form.Field>

              <div className="grid gap-4 md:grid-cols-3">
                <form.Field name="paymentMethod">
                  {(field) => (
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Payment method
                      <select
                        className="mt-1 flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:border-slate-800 dark:bg-slate-950"
                        value={field.state.value}
                        onChange={(event) =>
                          field.handleChange(event.target.value as 'CASH' | 'BANK_DEPOSIT')
                        }
                      >
                        <option value="CASH">Cash</option>
                        <option value="BANK_DEPOSIT">Bank deposit</option>
                      </select>
                    </label>
                  )}
                </form.Field>
                <form.Field name="amount">
                  {(field) => (
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Amount received (PHP)
                      <Input
                        className="mt-1"
                        value={field.state.value}
                        onChange={(event) => field.handleChange(event.target.value)}
                        placeholder="0.00"
                        inputMode="decimal"
                      />
                    </label>
                  )}
                </form.Field>
                <form.Field name="referenceNumber">
                  {(field) => (
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Deposit/reference no. (optional)
                      <Input
                        className="mt-1"
                        value={field.state.value}
                        onChange={(event) => field.handleChange(event.target.value)}
                        placeholder="Bank slip or cashier reference"
                      />
                    </label>
                  )}
                </form.Field>
              </div>

              <div className="flex flex-col justify-between gap-4 rounded-xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-900/40 dark:bg-blue-950/30 sm:flex-row sm:items-center">
                <div>
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Authoritative current balance
                  </p>
                  <p className="text-2xl font-extrabold text-blue-700 dark:text-blue-300">
                    {assessmentQuery.isLoading ? 'Loading…' : formatCentavos(balanceCentavos)}
                  </p>
                  {selectedStudent && (
                    <p className="mt-1 text-xs text-slate-500">
                      {selectedStudent.firstName} {selectedStudent.lastName} ·{' '}
                      {selectedStudent.schoolYearName ?? 'No school year'}
                    </p>
                  )}
                </div>
                <Button type="submit" className="bg-blue-600 text-xs text-white hover:bg-blue-700">
                  Post payment and issue receipt
                </Button>
              </div>
              {assessmentQuery.isError && (
                <p className="text-xs text-red-600">
                  {getClientErrorMessage(assessmentQuery.error)}
                </p>
              )}
              {formError && <p className="text-xs text-red-600">{formError}</p>}
            </form>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={successPayment !== null}
        onOpenChange={(open) => !open && setSuccessPayment(null)}
      >
        <DialogHeader>
          <DialogTitle>Payment posted</DialogTitle>
          <DialogDescription>
            The payment, oldest-item allocations, ledger entry, acknowledgment receipt, and audit
            event were committed together.
          </DialogDescription>
        </DialogHeader>
        {successPayment && (
          <div className="space-y-2 rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
            <p className="font-semibold">
              {formatCentavos(successPayment.amountCentavos)} received
            </p>
            <p className="font-mono text-xs">{successPayment.receipt?.receiptNumber}</p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setSuccessPayment(null)}>
            Close
          </Button>
          {successPayment && (
            <>
              <Link href={`/admin/transactions/${successPayment.id}`}>
                <Button>View transaction</Button>
              </Link>
              {successPayment.receipt && (
                <a
                  href={`/api/receipts/${successPayment.receipt.id}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button variant="outline">Download receipt PDF</Button>
                </a>
              )}
            </>
          )}
        </DialogFooter>
      </Dialog>
    </div>
  );
}
