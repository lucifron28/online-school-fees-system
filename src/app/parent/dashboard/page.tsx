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
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
            Screen #10 • PARENT DASHBOARD
          </Badge>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Dashboard
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Good day, Juan Dela Cruz Sr.! Here is the financial status of your enrolled children.
          </p>
        </div>

        <Link href="/parent/pay">
          <Button className="h-9 bg-emerald-600 text-xs text-white shadow-sm hover:bg-emerald-700">
            <CreditCard className="mr-1.5 h-4 w-4" />
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
              <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700 dark:bg-emerald-900/60">
                <CreditCard className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">
                ₱14,000.00
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Due for SY 2024–2025 across all enrolled children
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm dark:border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Total Paid (SY 2024–2025)
              </span>
              <div className="rounded-xl bg-blue-50 p-2 text-blue-600 dark:bg-blue-950/60">
                <DollarSign className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">
                ₱38,000.00
              </div>
              <p className="mt-1 text-xs text-slate-500">Total payments processed to date</p>
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
            <div className="flex flex-col justify-between gap-4 p-5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/50 sm:flex-row sm:items-center">
              <div className="flex items-center space-x-4">
                <ImagePlaceholder type="avatar" className="h-14 w-14 border-2 border-emerald-500" />
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Juan Dela Cruz Jr.
                  </h4>
                  <p className="font-mono text-xs text-slate-500">
                    Grade 10 - Section A • Student ID: 2024-0001
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between space-x-6 sm:justify-end">
                <div className="text-right">
                  <span className="text-[11px] text-slate-500">Outstanding Balance</span>
                  <p className="text-base font-extrabold text-rose-600">₱14,000.00</p>
                </div>

                <Link href="/parent/children/S2024-0001">
                  <Button variant="outline" size="sm" className="h-9 text-xs">
                    <span>View Details</span>
                    <ChevronRight className="ml-1 h-4 w-4 text-slate-400" />
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
