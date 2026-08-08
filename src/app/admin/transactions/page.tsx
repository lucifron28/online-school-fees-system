'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { requestJson, getClientErrorMessage } from '@/lib/client-api';
import { formatCentavos } from '@/lib/utils/currency';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Eye, Filter, RefreshCw, Search } from 'lucide-react';

type PaymentListItem = {
  id: string;
  amountCentavos: number;
  paymentMethod: string;
  referenceNumber: string | null;
  status: string;
  createdAt: string;
  studentNumber: string;
  studentFirstName: string;
  studentLastName: string;
  receiptNumber: string | null;
  receiptStatus: string | null;
};

type PaymentListResponse = {
  items: PaymentListItem[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};

function statusClass(status: string) {
  if (status === 'POSTED') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'REVERSED') return 'border-rose-200 bg-rose-50 text-rose-700';
  return 'border-slate-200 bg-slate-100 text-slate-600';
}

export default function AdminTransactionsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeSearch = searchParams.get('search') ?? '';
  const activeStatus = searchParams.get('status') ?? '';
  const activePage = Number(searchParams.get('page') ?? '1');
  const [search, setSearch] = useState(activeSearch);

  const paymentsQuery = useQuery({
    queryKey: ['admin-payments', activeSearch, activeStatus, activePage],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(activePage),
        pageSize: '20',
      });
      if (activeSearch) params.set('search', activeSearch);
      if (activeStatus) params.set('status', activeStatus);
      return requestJson<PaymentListResponse>(`/api/admin/payments?${params.toString()}`);
    },
  });

  function updateFilters(next: { search?: string; status?: string; page?: number }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.search !== undefined) {
      if (next.search) params.set('search', next.search);
      else params.delete('search');
    }
    if (next.status !== undefined) {
      if (next.status) params.set('status', next.status);
      else params.delete('status');
    }
    if (next.page !== undefined) {
      if (next.page > 1) params.set('page', String(next.page));
      else params.delete('page');
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  const data = paymentsQuery.data;
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
            Finance · transactions
          </Badge>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Financial transactions log
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Review persisted cash and bank-deposit payments and their acknowledgment receipts.
          </p>
        </div>
        <Link href="/admin/payments/manual">
          <Button className="bg-blue-600 text-xs text-white hover:bg-blue-700">Post payment</Button>
        </Link>
      </div>

      <Card className="border-slate-200 shadow-sm dark:border-slate-800">
        <CardHeader className="pb-4">
          <form
            className="grid gap-3 sm:grid-cols-[1fr_180px_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              updateFilters({ search, page: 1 });
            }}
          >
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search student, receipt, or reference"
                className="h-9 pl-8 text-xs"
              />
            </div>
            <select
              value={activeStatus}
              onChange={(event) => updateFilters({ status: event.target.value, page: 1 })}
              className="h-9 rounded-md border border-slate-200 bg-white px-3 text-xs dark:border-slate-800 dark:bg-slate-950"
            >
              <option value="">All statuses</option>
              <option value="POSTED">Posted</option>
              <option value="REVERSED">Reversed</option>
            </select>
            <Button type="submit" className="h-9 bg-blue-600 text-xs text-white hover:bg-blue-700">
              <Filter className="mr-1 h-3.5 w-3.5" /> Apply filters
            </Button>
          </form>
        </CardHeader>

        <CardContent className="p-0">
          {paymentsQuery.isLoading && (
            <p className="p-6 text-sm text-slate-500">Loading transactions…</p>
          )}
          {paymentsQuery.isError && (
            <div className="p-6">
              <p className="text-sm text-red-600">{getClientErrorMessage(paymentsQuery.error)}</p>
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => void paymentsQuery.refetch()}
              >
                <RefreshCw className="mr-1 h-3.5 w-3.5" /> Retry
              </Button>
            </div>
          )}
          {data && data.items.length === 0 && (
            <p className="p-6 text-sm text-slate-500">No persisted payments match these filters.</p>
          )}
          {data && data.items.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Receipt</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-mono text-xs font-bold">
                      {payment.receiptNumber ?? 'Receipt pending'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-slate-500">
                      {new Date(payment.createdAt).toLocaleDateString('en-PH')}
                    </TableCell>
                    <TableCell className="text-xs font-semibold">
                      <div>
                        {payment.studentFirstName} {payment.studentLastName}
                      </div>
                      <div className="font-mono text-[10px] text-slate-500">
                        {payment.studentNumber}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-bold">
                      {formatCentavos(payment.amountCentavos)}
                    </TableCell>
                    <TableCell className="text-xs">{payment.paymentMethod}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${statusClass(payment.status)}`}
                      >
                        {payment.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/admin/transactions/${payment.id}`}>
                        <Button variant="ghost" size="sm" className="h-8 text-xs text-blue-600">
                          <Eye className="mr-1 h-3.5 w-3.5" /> View
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {data && data.pageCount > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500 dark:border-slate-800">
              <span>
                Showing page {data.page} of {data.pageCount} ({data.total} payments)
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={data.page <= 1}
                  onClick={() => updateFilters({ page: data.page - 1 })}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={data.page >= data.pageCount}
                  onClick={() => updateFilters({ page: data.page + 1 })}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
