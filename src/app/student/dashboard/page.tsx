'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, CreditCard, DollarSign, RefreshCw } from 'lucide-react';
import { getClientErrorMessage, requestJson } from '@/lib/client-api';
import { paymentBalanceAmountClass, paymentStatusClass, paymentStatusLabel } from '@/lib/deadlines';
import { formatCentavos } from '@/lib/utils/currency';
import type { PortalAccount } from '@/lib/portal-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PortalAnnouncementPreview } from '@/components/announcements/announcement-list';

export default function StudentDashboardPage() {
  const accountQuery = useQuery({
    queryKey: ['student-account'],
    queryFn: () => requestJson<PortalAccount>('/api/portal/student/account'),
  });
  const account = accountQuery.data;

  return (
    <div className="space-y-6">
      <div>
        <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
          Student dashboard
        </Badge>
        <h2 className="mt-1 text-2xl font-bold tracking-tight">
          {account ? `Welcome, ${account.student.firstName}!` : 'Student portal'}
        </h2>
        <p className="text-xs text-slate-500">
          Your finance-posted assessment and payment records.
        </p>
      </div>

      {accountQuery.isLoading && <p className="text-sm text-slate-500">Loading your account…</p>}
      {accountQuery.isError && (
        <Card>
          <CardContent className="space-y-3 p-6">
            <p className="text-sm text-rose-600">{getClientErrorMessage(accountQuery.error)}</p>
            <Button variant="outline" onClick={() => void accountQuery.refetch()}>
              <RefreshCw className="mr-1.5 h-4 w-4" /> Retry
            </Button>
          </CardContent>
        </Card>
      )}
      {account && (
        <>
          <PortalAnnouncementPreview audience="STUDENT" />
          <div className="grid gap-6 sm:grid-cols-2">
            <Card className="border-blue-200 bg-blue-50/40 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-blue-800">Outstanding balance</span>
                  <CreditCard className="h-5 w-5 text-blue-700" />
                </div>
                <div
                  className={`mt-3 text-3xl font-extrabold ${paymentBalanceAmountClass(account.ledger.balanceCentavos === 0 ? 'PAID' : 'WITH_REMAINING_BALANCE')}`}
                >
                  {formatCentavos(account.ledger.balanceCentavos)}
                </div>
                <p className="mt-1 text-xs text-slate-500">Current finance ledger balance</p>
                <Badge
                  variant="outline"
                  className={`mt-2 ${paymentStatusClass(account.ledger.balanceCentavos === 0 ? 'PAID' : 'WITH_REMAINING_BALANCE')}`}
                >
                  {paymentStatusLabel(
                    account.ledger.balanceCentavos === 0 ? 'PAID' : 'WITH_REMAINING_BALANCE'
                  )}
                </Badge>
              </CardContent>
            </Card>
            <Card className="border-sky-200 bg-sky-50/40 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-sky-800">Net payments</span>
                  <DollarSign className="h-5 w-5 text-sky-700" />
                </div>
                <div className="mt-3 text-3xl font-extrabold">
                  {formatCentavos(account.student.totalPaidCentavos)}
                </div>
                <p className="mt-1 text-xs text-slate-500">Payments less persisted reversals</p>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-sm">
            <CardHeader className="border-b">
              <CardTitle className="text-base">My account</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col justify-between gap-4 p-6 sm:flex-row sm:items-center">
              <div>
                <h4 className="text-base font-bold">
                  {account.student.firstName} {account.student.lastName}
                </h4>
                <p className="font-mono text-xs text-slate-500">
                  {account.student.studentNumber} ·{' '}
                  {account.student.gradeLevelName ?? 'Grade not assigned'}
                  {account.student.sectionName ? ` · ${account.student.sectionName}` : ''}
                </p>
              </div>
              <Link href="/student/account">
                <Button variant="outline" className="h-9 text-xs">
                  View full account <ChevronRight className="ml-1 h-4 w-4 text-slate-400" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
