'use me';
'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { ArrowLeft, Printer, Download, CheckCircle2, Building2 } from 'lucide-react';

export default function ParentReceiptPage({ params }: { params: { id?: string } }) {
  const receiptId = params?.id || 'OR-2024-000123';

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link href="/parent/dashboard">
            <Button variant="outline" size="sm" className="h-9 px-3 text-xs">
              <ArrowLeft className="h-4 w-4 mr-1" />
              <span>Dashboard</span>
            </Button>
          </Link>
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
            Screen #13 • PARENT - PAYMENT RECEIPT
          </Badge>
        </div>

        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 shadow-sm">
          <Download className="h-4 w-4 mr-1.5" />
          <span>Download / Print Receipt</span>
        </Button>
      </div>

      {/* Official Receipt Card */}
      <Card className="border border-slate-300 shadow-lg dark:border-slate-800 bg-white dark:bg-slate-900">
        <CardContent className="p-8 space-y-6">
          {/* Header */}
          <div className="text-center border-b border-slate-200 dark:border-slate-800 pb-6">
            <div className="flex justify-center mb-2">
              <div className="h-12 w-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                <Building2 className="h-6 w-6" />
              </div>
            </div>
            <h2 className="text-lg font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
              Official Receipt
            </h2>
            <p className="text-xs text-slate-500">School Fees Monitoring and Payment System</p>
            <p className="text-[10px] text-slate-400 mt-0.5">123 School Street, Malabon, Quezon</p>
          </div>

          {/* Receipt Info Grid */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-400 font-mono">OR No:</span>
              <p className="font-bold font-mono text-slate-900 dark:text-slate-100">{receiptId}</p>
            </div>
            <div>
              <span className="text-slate-400">Date:</span>
              <p className="font-semibold text-slate-900 dark:text-slate-100">May 30, 2024</p>
            </div>
            <div>
              <span className="text-slate-400">Received From:</span>
              <p className="font-semibold text-slate-900 dark:text-slate-100">Juan Dela Cruz Sr.</p>
            </div>
            <div>
              <span className="text-slate-400">Student Name:</span>
              <p className="font-semibold text-slate-900 dark:text-slate-100">Juan Dela Cruz Jr.</p>
            </div>
            <div>
              <span className="text-slate-400">Grade & Section:</span>
              <p className="font-semibold text-slate-900 dark:text-slate-100">Grade 10 - A</p>
            </div>
            <div>
              <span className="text-slate-400">Payment Method:</span>
              <p className="font-semibold text-slate-900 dark:text-slate-100">GCash</p>
            </div>
          </div>

          {/* Itemized Table */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-800">
                  <TableHead className="text-xs font-semibold text-slate-700">Description</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-slate-700">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-xs font-medium">Tuition Fee (Partial)</TableCell>
                  <TableCell className="text-right text-xs font-mono font-bold">₱12,000.00</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-xs font-medium">Miscellaneous Fee</TableCell>
                  <TableCell className="text-right text-xs font-mono font-bold">₱2,000.00</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <div className="flex justify-between items-center p-4 bg-slate-100 dark:bg-slate-800/80 font-bold text-sm border-t border-slate-200 dark:border-slate-800">
              <span>Total Amount Paid:</span>
              <span className="text-emerald-700 dark:text-emerald-400 font-mono text-lg">₱14,000.00</span>
            </div>
          </div>

          {/* Footer Note */}
          <div className="text-center pt-4 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Thank you for your payment!</p>
            <p className="text-[10px] text-slate-400 mt-1">This is an officially generated digital receipt. No signature required.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
