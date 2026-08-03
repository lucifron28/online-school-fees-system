'use me';
'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ImagePlaceholder } from '@/components/ui/image-placeholder';
import { CreditCard, DollarSign, Users, ChevronRight, GraduationCap } from 'lucide-react';

export default function ParentDashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
            Screen #10 • PARENT DASHBOARD
          </Badge>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mt-1">
            Dashboard
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Good day, Juan Dela Cruz Sr.! Here is the financial status of your enrolled children.
          </p>
        </div>

        <Link href="/parent/pay">
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 shadow-sm">
            <CreditCard className="h-4 w-4 mr-1.5" />
            <span>Make Online Payment</span>
          </Button>
        </Link>
      </div>

      {/* Top Metric Cards */}
      <div className="grid gap-6 sm:grid-cols-2">
        <Card className="border-emerald-200 bg-emerald-50/40 shadow-sm dark:border-emerald-950 dark:bg-emerald-950/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                Total Outstanding Balance
              </span>
              <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700">
                <CreditCard className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">₱14,000.00</div>
              <p className="text-xs text-slate-500 mt-1">Due for SY 2024–2025 across all enrolled children</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm dark:border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Total Paid (SY 2024–2025)
              </span>
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60">
                <DollarSign className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">₱38,000.00</div>
              <p className="text-xs text-slate-500 mt-1">Total payments processed to date</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* My Children List */}
      <Card className="border-slate-200 shadow-sm dark:border-slate-800">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800">
          <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">
            My Children
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors gap-4">
              <div className="flex items-center space-x-4">
                <ImagePlaceholder type="avatar" className="h-14 w-14 border-2 border-emerald-500" />
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Juan Dela Cruz Jr.</h4>
                  <p className="text-xs text-slate-500 font-mono">Grade 10 - Section A • Student ID: 2024-0001</p>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end space-x-6">
                <div className="text-right">
                  <span className="text-[11px] text-slate-500">Outstanding Balance</span>
                  <p className="text-base font-extrabold text-rose-600">₱14,000.00</p>
                </div>

                <Link href="/parent/children/S2024-0001">
                  <Button variant="outline" size="sm" className="h-9 text-xs">
                    <span>View Details</span>
                    <ChevronRight className="h-4 w-4 ml-1 text-slate-400" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
