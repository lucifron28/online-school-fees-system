'use me';
'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Eye, Download } from 'lucide-react';

export default function ParentPaymentHistoryPage() {
  const history = [
    { id: 'OR-2024-000123', date: 'May 30, 2024', amount: '₱14,000.00', method: 'GCash', status: 'Completed' },
    { id: 'OR-2024-000100', date: 'Jan 15, 2024', amount: '₱12,000.00', method: 'Cash', status: 'Completed' },
    { id: 'OR-2023-000088', date: 'Nov 04, 2023', amount: '₱14,000.00', method: 'GCash', status: 'Completed' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
          Screen #14 • PARENT - PAYMENT HISTORY
        </Badge>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mt-1">
          Payment History
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Complete ledger history of processed online and over-the-counter payments
        </p>
      </div>

      <Card className="border-slate-200 shadow-sm dark:border-slate-800">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>OR No.</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Payment Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">{tx.id}</TableCell>
                  <TableCell className="text-xs text-slate-500">{tx.date}</TableCell>
                  <TableCell className="text-xs font-bold text-slate-900 dark:text-slate-100">{tx.amount}</TableCell>
                  <TableCell className="text-xs">
                    <span className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-medium">
                      {tx.method}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                      {tx.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/parent/receipts/${tx.id}`}>
                      <Button variant="ghost" size="sm" className="h-8 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50">
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        <span>View Receipt</span>
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
