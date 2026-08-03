'use me';
'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { ImagePlaceholder } from '@/components/ui/image-placeholder';
import { ArrowLeft, CreditCard, Download } from 'lucide-react';

export default function ParentChildDetailsPage({ params }: { params: { id?: string } }) {
  const fees = [
    { desc: "Tuition Fee (Full Year)", net: "₱14,000.00", paid: "₱12,000.00", balance: "₱12,000.00", status: "Partial" },
    { desc: "Miscellaneous Fee", net: "₱2,000.00", paid: "₱0.00", balance: "₱2,000.00", status: "Unpaid" },
    { desc: "Enrollment Fee", net: "₱2,500.00", paid: "₱2,500.00", balance: "₱0.00", status: "Paid" },
    { desc: "Laboratory Fee", net: "₱2,500.00", paid: "₱2,500.00", balance: "₱0.00", status: "Paid" },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link href="/parent/dashboard">
            <Button variant="outline" size="sm" className="h-9 px-3 text-xs">
              <ArrowLeft className="h-4 w-4 mr-1" />
              <span>Back to Dashboard</span>
            </Button>
          </Link>
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
            Screen #11 • PARENT - CHILD ACCOUNT DETAILS
          </Badge>
        </div>

        <Link href="/parent/pay">
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9">
            <CreditCard className="h-4 w-4 mr-1.5" />
            <span>Pay Current Outstanding Balance</span>
          </Button>
        </Link>
      </div>

      {/* Student Banner */}
      <Card className="border-slate-200 shadow-sm dark:border-slate-800">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center space-x-5">
              <ImagePlaceholder type="avatar" className="h-16 w-16 border-2 border-emerald-500" />
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Juan Dela Cruz Jr.</h2>
                <p className="text-xs text-slate-500 font-mono mt-0.5">Grade 10 - A • SY 2024–2025</p>
                <p className="text-xs text-slate-400 font-mono">Student ID: 2024-0001</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 dark:bg-rose-950/40 dark:border-rose-900/40 text-right min-w-[200px]">
              <span className="text-xs font-semibold text-rose-700 dark:text-rose-400">Total Outstanding Balance</span>
              <p className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-1">₱14,000.00</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fee Breakdown Table */}
      <Card className="border-slate-200 shadow-sm dark:border-slate-800">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-semibold">Fee Breakdown Statement</CardTitle>
          <Button variant="outline" size="sm" className="h-8 text-xs">
            <Download className="h-3.5 w-3.5 mr-1" />
            <span>Download Statement (PDF)</span>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead>Net Fee</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fees.map((fee, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-semibold text-xs text-slate-900 dark:text-slate-100">{fee.desc}</TableCell>
                  <TableCell className="text-xs">{fee.net}</TableCell>
                  <TableCell className="text-xs text-emerald-600 font-medium">{fee.paid}</TableCell>
                  <TableCell className="text-xs font-bold text-slate-900 dark:text-slate-100">{fee.balance}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        fee.status === 'Paid'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]'
                          : fee.status === 'Partial'
                          ? 'bg-amber-50 text-amber-700 border-amber-200 text-[10px]'
                          : 'bg-rose-50 text-rose-700 border-rose-200 text-[10px]'
                      }
                    >
                      {fee.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 text-xs">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Total Outstanding Balance:</span>
            <span className="text-base font-extrabold text-rose-600">₱14,000.00</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
