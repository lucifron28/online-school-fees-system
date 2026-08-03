'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { ArrowLeft, Printer, AlertTriangle, CheckCircle2, Receipt } from 'lucide-react';

export default function AdminTransactionDetailsPage({
  params,
}: {
  params: Promise<{ id?: string }>;
}) {
  const resolvedParams = React.use(params);
  const transactionId = resolvedParams?.id || 'OR-2024-000123';

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link href="/admin/transactions">
            <Button variant="outline" size="sm" className="h-9 px-3 text-xs">
              <ArrowLeft className="mr-1 h-4 w-4" />
              <span>Back to Transactions</span>
            </Button>
          </Link>
          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
            Screen #20 • LAST TRANSACTION DETAILS (ADMIN)
          </Badge>
        </div>

        <Button className="h-9 bg-blue-600 text-xs text-white hover:bg-blue-700">
          <Printer className="mr-1.5 h-4 w-4" />
          <span>Print Receipt</span>
        </Button>
      </div>

      <Card className="border-slate-200 shadow-sm dark:border-slate-800">
        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 dark:border-slate-800">
          <div>
            <span className="font-mono text-xs text-slate-500">Official Receipt Number</span>
            <CardTitle className="font-mono text-xl font-bold text-slate-900 dark:text-slate-100">
              {transactionId}
            </CardTitle>
          </div>
          <Badge
            variant="outline"
            className="border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700"
          >
            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
            Transaction Completed
          </Badge>
        </CardHeader>

        <CardContent className="space-y-6 p-6">
          <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-4">
            <div>
              <span className="text-[11px] font-medium text-slate-500">Transaction Date</span>
              <p className="mt-0.5 text-xs font-semibold text-slate-900 dark:text-slate-100">
                May 30, 2024
              </p>
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-500">Student Name</span>
              <p className="mt-0.5 text-xs font-semibold text-slate-900 dark:text-slate-100">
                Juan Dela Cruz
              </p>
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-500">Grade & Section</span>
              <p className="mt-0.5 text-xs font-semibold text-slate-900 dark:text-slate-100">
                Grade 10 - A
              </p>
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-500">Payment Method</span>
              <p className="mt-0.5 text-xs font-semibold text-slate-900 dark:text-slate-100">
                GCash (Online)
              </p>
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Payment Breakdown
            </h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fee Description</TableHead>
                  <TableHead className="text-right">Amount Paid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-xs font-medium">Tuition Fee (Partial/Full)</TableCell>
                  <TableCell className="text-right font-mono text-xs font-bold">
                    ₱12,000.00
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-xs font-medium">Miscellaneous Fee</TableCell>
                  <TableCell className="text-right font-mono text-xs font-bold">
                    ₱2,000.00
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/40">
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Total Amount Paid
            </span>
            <span className="text-2xl font-extrabold text-blue-700 dark:text-blue-300">
              ₱14,000.00
            </span>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
            <span className="text-xs text-slate-400">Processed by: Cashier Admin Staff</span>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <AlertTriangle className="mr-1 h-3.5 w-3.5" />
              <span>Void Transaction</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
