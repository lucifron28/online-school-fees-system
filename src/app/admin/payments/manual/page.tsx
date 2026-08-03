'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { CheckCircle2, User, Wallet, DollarSign, ArrowLeft } from 'lucide-react';

export default function AdminManualPaymentPage() {
  const [selectedStudent, setSelectedStudent] = useState('2024-0001');
  const [amountPaid, setAmountPaid] = useState('14000');
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);

  const balances = [
    { id: 'b1', item: 'Tuition Fee (Full Year)', net: '₱12,000.00', selected: true },
    { id: 'b2', item: 'Miscellaneous Fee', net: '₱2,000.00', selected: true },
    { id: 'b3', item: 'Laboratory Fee', net: '₱1,500.00', selected: false },
  ];

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center space-x-3">
        <Link href="/admin/dashboard">
          <Button variant="outline" size="sm" className="h-9 px-3 text-xs">
            <ArrowLeft className="mr-1 h-4 w-4" />
            <span>Dashboard</span>
          </Button>
        </Link>
        <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
          Screen #5 • ADMIN - MAKE PAYMENT (MANUAL)
        </Badge>
      </div>

      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Over-The-Counter Payment Processing
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Record manual cashier payments, select outstanding balance items, and issue digital
          receipts
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Form Column */}
        <Card className="border-slate-200 shadow-sm dark:border-slate-800 lg:col-span-2">
          <CardHeader className="border-b border-slate-100 pb-3 dark:border-slate-800">
            <CardTitle className="text-base font-semibold">
              1. Select Student & Payment Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 p-6">
            {/* Student Dropdown */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Select Student
              </label>
              <div className="relative">
                <select
                  value={selectedStudent}
                  onChange={(e) => setSelectedStudent(e.target.value)}
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="2024-0001">Juan Dela Cruz (2024-0001) — Grade 10 - A</option>
                  <option value="2024-0002">Maria Santos (2024-0002) — Grade 11 - B</option>
                  <option value="2024-0003">Pedro Reyes (2024-0003) — Grade 12 - A</option>
                </select>
              </div>
            </div>

            {/* Payment Details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Payment Date
                </label>
                <Input type="date" defaultValue="2024-05-30" className="h-9 text-xs" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Payment Method
                </label>
                <select className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs dark:border-slate-800 dark:bg-slate-900">
                  <option>Cash (OTC)</option>
                  <option>Check</option>
                  <option>Bank Transfer / Over-The-Counter</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Amount Tendered (₱)
                </label>
                <Input
                  type="number"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  className="h-10 text-sm font-bold"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Reference No. (Optional)
                </label>
                <Input placeholder="Enter reference number..." className="h-10 text-xs" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Balance Summary Column */}
        <Card className="flex flex-col justify-between border-slate-200 shadow-sm dark:border-slate-800">
          <div>
            <CardHeader className="border-b border-slate-100 pb-3 dark:border-slate-800">
              <CardTitle className="text-base font-semibold">2. Outstanding Balances</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
              {balances.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-900/50"
                >
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      defaultChecked={b.selected}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600"
                    />
                    <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                      {b.item}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {b.net}
                  </span>
                </div>
              ))}
            </CardContent>
          </div>

          <div className="space-y-4 rounded-b-xl border-t border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Total Outstanding:
              </span>
              <span className="text-xl font-extrabold text-rose-600">₱14,000.00</span>
            </div>

            <Button
              onClick={() => setIsSuccessOpen(true)}
              className="h-10 w-full bg-blue-600 text-xs font-semibold text-white shadow-md hover:bg-blue-700"
            >
              Confirm OTC Payment
            </Button>
          </div>
        </Card>
      </div>

      {/* Confirmation Modal */}
      <Dialog open={isSuccessOpen} onOpenChange={setIsSuccessOpen}>
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center">Payment Processed Successfully!</DialogTitle>
          <DialogDescription className="text-center">
            Official Receipt <strong className="font-mono text-slate-900">OR-2024-000123</strong>{' '}
            generated for Juan Dela Cruz.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="sm:justify-center">
          <Link href="/admin/transactions/OR-2024-000123">
            <Button className="h-9 bg-blue-600 text-xs text-white">View Official Receipt</Button>
          </Link>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
