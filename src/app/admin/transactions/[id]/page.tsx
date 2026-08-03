'use me';
'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { ArrowLeft, Printer, AlertTriangle, CheckCircle2, Receipt } from 'lucide-react';

export default function AdminTransactionDetailsPage({ params }: { params: { id?: string } }) {
  const transactionId = params?.id || 'OR-2024-000123';

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link href="/admin/transactions">
            <Button variant="outline" size="sm" className="h-9 px-3 text-xs">
              <ArrowLeft className="h-4 w-4 mr-1" />
              <span>Back to Transactions</span>
            </Button>
          </Link>
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            Screen #20 • LAST TRANSACTION DETAILS (ADMIN)
          </Badge>
        </div>

        <Button className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-9">
          <Printer className="h-4 w-4 mr-1.5" />
          <span>Print Receipt</span>
        </Button>
      </div>

      <Card className="border-slate-200 shadow-sm dark:border-slate-800">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-mono">Official Receipt Number</span>
            <CardTitle className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100">{transactionId}</CardTitle>
          </div>
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs px-3 py-1">
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            Transaction Completed
          </Badge>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div>
              <span className="text-[11px] text-slate-500 font-medium">Transaction Date</span>
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 mt-0.5">May 30, 2024</p>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 font-medium">Student Name</span>
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 mt-0.5">Juan Dela Cruz</p>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 font-medium">Grade & Section</span>
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 mt-0.5">Grade 10 - A</p>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 font-medium">Payment Method</span>
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 mt-0.5">GCash (Online)</p>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
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
                  <TableCell className="text-right text-xs font-mono font-bold">₱12,000.00</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-xs font-medium">Miscellaneous Fee</TableCell>
                  <TableCell className="text-right text-xs font-mono font-bold">₱2,000.00</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">Total Amount Paid</span>
            <span className="text-2xl font-extrabold text-blue-700 dark:text-blue-300">₱14,000.00</span>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs text-slate-400">Processed by: Cashier Admin Staff</span>
            <Button variant="ghost" size="sm" className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50">
              <AlertTriangle className="h-3.5 w-3.5 mr-1" />
              <span>Void Transaction</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
