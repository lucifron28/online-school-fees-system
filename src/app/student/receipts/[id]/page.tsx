'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
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
import { ArrowLeft, Download, Building2 } from 'lucide-react';

export default function StudentReceiptPage({ params }: { params: Promise<{ id?: string }> }) {
  const resolvedParams = React.use(params);
  const receiptId = resolvedParams?.id || 'OR-2024-000123';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link href="/student/dashboard">
            <Button variant="outline" size="sm" className="h-9 px-3 text-xs">
              <ArrowLeft className="mr-1 h-4 w-4" />
              <span>Dashboard</span>
            </Button>
          </Link>
          <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700">
            Screen #19 • STUDENT - PAYMENT RECEIPT (VIEW)
          </Badge>
        </div>

        <Button className="h-9 bg-purple-600 text-xs text-white shadow-sm hover:bg-purple-700">
          <Download className="mr-1.5 h-4 w-4" />
          <span>Download Receipt (PDF)</span>
        </Button>
      </div>

      <Card className="border border-slate-300 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900">
        <CardContent className="space-y-6 p-8">
          <div className="border-b border-slate-200 pb-6 text-center dark:border-slate-800">
            <div className="mb-2 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-600 font-bold text-white">
                <Building2 className="h-6 w-6" />
              </div>
            </div>
            <h2 className="text-lg font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
              OFFICIAL RECEIPT
            </h2>
            <p className="text-xs text-slate-500">School Fees Monitoring and Payment System</p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="font-mono text-slate-400">OR No:</span>
              <p className="font-mono font-bold text-slate-900 dark:text-slate-100">{receiptId}</p>
            </div>
            <div>
              <span className="text-slate-400">Date:</span>
              <p className="font-semibold text-slate-900 dark:text-slate-100">May 30, 2024</p>
            </div>
            <div>
              <span className="text-slate-400">Student Name:</span>
              <p className="font-semibold text-slate-900 dark:text-slate-100">Juan Dela Cruz Jr.</p>
            </div>
            <div>
              <span className="text-slate-400">Grade & Section:</span>
              <p className="font-semibold text-slate-900 dark:text-slate-100">Grade 10 - A</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-800">
                  <TableHead className="text-xs font-semibold text-slate-700">
                    Description
                  </TableHead>
                  <TableHead className="text-right text-xs font-semibold text-slate-700">
                    Amount
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-xs font-medium">Tuition Fee (Partial)</TableCell>
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
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-100 p-4 text-sm font-bold dark:border-slate-800 dark:bg-slate-800/80">
              <span>Total Amount Paid:</span>
              <span className="font-mono text-lg text-purple-700 dark:text-purple-400">
                ₱14,000.00
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
