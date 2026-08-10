'use client';

import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adjustmentPostInputSchema, assessmentPostInputSchema } from '@/lib/assessments';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RefreshCw } from 'lucide-react';

type StudentProfile = {
  id: string;
  schoolYearId: string | null;
  gradeLevelId: string | null;
};

type AssessmentItem = {
  id: string;
  name: string;
  amountCentavos: number;
  feeCategoryName: string;
  feeCategoryCode: string;
};

type StudentAssessment = {
  id: string;
  studentId: string;
  schoolYearId: string;
  feeStructureId: string;
  assessmentPeriod: string;
  totalAmountCentavos: number;
  balanceCentavos: number;
  status: string;
  createdAt: string;
  schoolYearName: string;
  feeStructureName: string;
  items: AssessmentItem[];
};

type LedgerEntry = {
  id: string;
  entryType: string;
  debitCentavos: number;
  creditCentavos: number;
  balanceCentavos: number;
  description: string;
  createdAt: string;
};

type AssessmentsResponse = {
  assessments: StudentAssessment[];
  ledger: {
    entries: LedgerEntry[];
    balanceCentavos: number;
  };
};

type FeeStructure = {
  id: string;
  name: string;
  assessmentPeriod: string;
  items: Array<{ id: string; name: string; amountCentavos: number }>;
};

function statusClass(status: string) {
  if (status === 'POSTED') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'CANCELLED') return 'border-rose-200 bg-rose-50 text-rose-700';
  return 'border-amber-200 bg-amber-50 text-amber-700';
}

export function StudentAssessments({ student }: { student: StudentProfile }) {
  const queryClient = useQueryClient();
  const [postDialogOpen, setPostDialogOpen] = useState(false);
  const [selectedStructureId, setSelectedStructureId] = useState('');
  const [postError, setPostError] = useState('');
  const [adjustmentAssessment, setAdjustmentAssessment] = useState<StudentAssessment | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<'DEBIT' | 'CREDIT'>('DEBIT');
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [adjustmentError, setAdjustmentError] = useState('');

  const assessmentsQuery = useQuery({
    queryKey: ['admin-student-assessments', student.id],
    queryFn: () =>
      requestJson<AssessmentsResponse>(`/api/admin/students/${student.id}/assessments`),
  });

  const structuresQuery = useQuery({
    queryKey: ['admin-student-assessment-structures', student.schoolYearId, student.gradeLevelId],
    enabled: Boolean(student.schoolYearId && student.gradeLevelId),
    queryFn: () => {
      const params = new URLSearchParams({ status: 'ACTIVE' });
      if (student.schoolYearId) params.set('schoolYearId', student.schoolYearId);
      if (student.gradeLevelId) params.set('gradeLevelId', student.gradeLevelId);
      return requestJson<FeeStructure[]>(`/api/admin/fee-structures?${params.toString()}`);
    },
  });

  const postAssessment = useMutation({
    mutationFn: async (feeStructureId: string) => {
      const body = assessmentPostInputSchema.parse({ feeStructureId });
      return requestJson<StudentAssessment>(`/api/admin/students/${student.id}/assessments`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: async () => {
      setPostDialogOpen(false);
      setSelectedStructureId('');
      setPostError('');
      await queryClient.invalidateQueries({ queryKey: ['admin-student-assessments', student.id] });
    },
    onError: (error) => setPostError(getClientErrorMessage(error)),
  });

  const postAdjustment = useMutation({
    mutationFn: async (input: {
      type: 'DEBIT' | 'CREDIT';
      amountCentavos: number;
      reason: string;
    }) => {
      if (!adjustmentAssessment) throw new Error('Select an assessment first.');
      const body = adjustmentPostInputSchema.parse(input);
      return requestJson(`/api/admin/assessments/${adjustmentAssessment.id}/adjustments`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: async () => {
      setAdjustmentAssessment(null);
      setAdjustmentAmount('');
      setAdjustmentReason('');
      setAdjustmentError('');
      await queryClient.invalidateQueries({ queryKey: ['admin-student-assessments', student.id] });
    },
    onError: (error) => setAdjustmentError(getClientErrorMessage(error)),
  });

  function submitAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPostError('');
    const parsed = assessmentPostInputSchema.safeParse({ feeStructureId: selectedStructureId });
    if (!parsed.success) {
      setPostError('Choose an active fee structure.');
      return;
    }
    postAssessment.mutate(parsed.data.feeStructureId);
  }

  function submitAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAdjustmentError('');
    let amountCentavos: number;
    try {
      amountCentavos = parseMoneyInput(adjustmentAmount);
    } catch (error) {
      setAdjustmentError(getClientErrorMessage(error));
      return;
    }
    const parsed = adjustmentPostInputSchema.safeParse({
      type: adjustmentType,
      amountCentavos,
      reason: adjustmentReason,
    });
    if (!parsed.success) {
      setAdjustmentError('Enter a positive amount and a reason for the adjustment.');
      return;
    }
    postAdjustment.mutate(parsed.data);
  }

  const data = assessmentsQuery.data;
  return (
    <div className="space-y-6">
      <Card className="border-slate-200 shadow-sm dark:border-slate-800">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Assessments</CardTitle>
            <p className="mt-1 text-xs text-slate-500">
              Amounts below are snapshots from the fee structure at posting time.
            </p>
          </div>
          <Button
            className="bg-blue-600 text-xs text-white hover:bg-blue-700"
            onClick={() => {
              setPostError('');
              setPostDialogOpen(true);
            }}
            disabled={student.schoolYearId === null || student.gradeLevelId === null}
          >
            Post assessment
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {assessmentsQuery.isLoading && (
            <p className="p-6 text-sm text-slate-500">Loading persisted assessments…</p>
          )}
          {assessmentsQuery.isError && (
            <div className="p-6">
              <p className="text-sm text-red-600">
                {getClientErrorMessage(assessmentsQuery.error)}
              </p>
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => void assessmentsQuery.refetch()}
              >
                <RefreshCw className="mr-1 h-3.5 w-3.5" /> Retry
              </Button>
            </div>
          )}
          {data && data.assessments.length === 0 && (
            <p className="p-6 text-sm text-slate-500">
              No assessments have been posted for this student.
            </p>
          )}
          {data && data.assessments.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assessment</TableHead>
                  <TableHead>Snapshot items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.assessments.map((assessment) => (
                  <TableRow key={assessment.id}>
                    <TableCell className="text-xs">
                      <div className="font-semibold">{assessment.feeStructureName}</div>
                      <div className="text-slate-500">
                        {assessment.schoolYearName} · {assessment.assessmentPeriod}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[260px] text-xs text-slate-600">
                      {assessment.items
                        .map((item) => `${item.name} (${formatCentavos(item.amountCentavos)})`)
                        .join(', ')}
                    </TableCell>
                    <TableCell className="text-xs font-semibold">
                      {formatCentavos(assessment.totalAmountCentavos)}
                    </TableCell>
                    <TableCell className="text-xs font-bold text-blue-700">
                      {formatCentavos(assessment.balanceCentavos)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${statusClass(assessment.status)}`}
                      >
                        {assessment.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-[11px]"
                        onClick={() => {
                          setAdjustmentError('');
                          setAdjustmentAssessment(assessment);
                        }}
                        disabled={assessment.status !== 'POSTED'}
                      >
                        Adjust
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {student.schoolYearId === null || student.gradeLevelId === null ? (
            <p className="border-t border-slate-100 p-4 text-xs text-amber-700 dark:border-slate-800">
              Assign the student to a school year and grade level before posting an assessment.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm dark:border-slate-800">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Student ledger</CardTitle>
            <p className="mt-1 text-xs text-slate-500">
              Balance is calculated from persisted ledger entries.
            </p>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase tracking-wide text-slate-500">
              Current balance
            </span>
            <p className="text-lg font-bold text-blue-700">
              {formatCentavos(data?.ledger.balanceCentavos ?? 0)}
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!data || data.ledger.entries.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No ledger entries have been recorded.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Entry</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Debit</TableHead>
                  <TableHead>Credit</TableHead>
                  <TableHead>Running balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.ledger.entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap text-xs text-slate-500">
                      {new Date(entry.createdAt).toLocaleDateString('en-PH')}
                    </TableCell>
                    <TableCell className="text-xs font-semibold">{entry.entryType}</TableCell>
                    <TableCell className="text-xs">{entry.description}</TableCell>
                    <TableCell className="text-xs text-rose-700">
                      {entry.debitCentavos ? formatCentavos(entry.debitCentavos) : 'No debit'}
                    </TableCell>
                    <TableCell className="text-xs text-emerald-700">
                      {entry.creditCentavos ? formatCentavos(entry.creditCentavos) : 'No credit'}
                    </TableCell>
                    <TableCell className="text-xs font-bold">
                      {formatCentavos(entry.balanceCentavos)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={postDialogOpen} onOpenChange={setPostDialogOpen}>
        <DialogHeader>
          <DialogTitle>Post assessment</DialogTitle>
          <DialogDescription>
            The server will load the active fee structure and snapshot its authoritative items.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submitAssessment}>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Active fee structure
            <select
              className="mt-1 flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:border-slate-800 dark:bg-slate-950"
              value={selectedStructureId}
              onChange={(event) => setSelectedStructureId(event.target.value)}
              disabled={structuresQuery.isLoading || postAssessment.isPending}
            >
              <option value="">Select a structure</option>
              {(structuresQuery.data ?? []).map((structure) => (
                <option key={structure.id} value={structure.id}>
                  {structure.name} ({structure.assessmentPeriod}) :{' '}
                  {formatCentavos(
                    structure.items.reduce((total, item) => total + item.amountCentavos, 0)
                  )}
                </option>
              ))}
            </select>
          </label>
          {structuresQuery.isError && (
            <p className="mt-2 text-xs text-red-600">
              {getClientErrorMessage(structuresQuery.error)}
            </p>
          )}
          {postError && <p className="mt-3 text-xs text-red-600">{postError}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPostDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={postAssessment.isPending || structuresQuery.isLoading}>
              {postAssessment.isPending ? 'Posting…' : 'Post assessment'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      <Dialog
        open={adjustmentAssessment !== null}
        onOpenChange={(open) => {
          if (!open) setAdjustmentAssessment(null);
        }}
      >
        <DialogHeader>
          <DialogTitle>Adjust assessment</DialogTitle>
          <DialogDescription>
            {adjustmentAssessment?.feeStructureName ?? 'Assessment'} : credit adjustments cannot
            exceed the current ledger balance.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submitAdjustment}>
          <div className="space-y-4">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Adjustment type
              <select
                className="mt-1 flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:border-slate-800 dark:bg-slate-950"
                value={adjustmentType}
                onChange={(event) => setAdjustmentType(event.target.value as 'DEBIT' | 'CREDIT')}
                disabled={postAdjustment.isPending}
              >
                <option value="DEBIT">Debit : increase balance</option>
                <option value="CREDIT">Credit : reduce balance</option>
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Amount (PHP)
              <Input
                className="mt-1"
                value={adjustmentAmount}
                onChange={(event) => setAdjustmentAmount(event.target.value)}
                placeholder="0.00"
                inputMode="decimal"
                disabled={postAdjustment.isPending}
              />
            </label>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Reason
              <textarea
                className="mt-1 min-h-20 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-600 dark:border-slate-800 dark:bg-slate-950"
                value={adjustmentReason}
                onChange={(event) => setAdjustmentReason(event.target.value)}
                placeholder="Explain why this adjustment is needed"
                disabled={postAdjustment.isPending}
              />
            </label>
          </div>
          {adjustmentError && <p className="mt-3 text-xs text-red-600">{adjustmentError}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAdjustmentAssessment(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={postAdjustment.isPending}>
              {postAdjustment.isPending ? 'Saving…' : 'Save adjustment'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
}
