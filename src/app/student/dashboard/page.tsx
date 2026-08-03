'use me';
'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ImagePlaceholder } from '@/components/ui/image-placeholder';
import { CreditCard, DollarSign, ChevronRight, GraduationCap } from 'lucide-react';

export default function StudentDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
          Screen #16 • STUDENT DASHBOARD
        </Badge>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mt-1">
          Welcome, Juan Dela Cruz Jr.!
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Student Portal — Grade 10 Section A • SY 2024–2025
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-6 sm:grid-cols-2">
        <Card className="border-rose-200 bg-rose-50/40 shadow-sm dark:border-rose-950 dark:bg-rose-950/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-rose-800 dark:text-rose-300">
                Outstanding Balance
              </span>
              <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-700">
                <CreditCard className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">₱14,000.00</div>
              <p className="text-xs text-slate-500 mt-1">Current pending fee balance</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-purple-50/40 shadow-sm dark:border-purple-950 dark:bg-purple-950/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-purple-800 dark:text-purple-300">
                Total Paid
              </span>
              <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/60 text-purple-700">
                <DollarSign className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">₱12,000.00</div>
              <p className="text-xs text-slate-500 mt-1">Total payments made this school year</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* My Account Summary Card */}
      <Card className="border-slate-200 shadow-sm dark:border-slate-800">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800">
          <CardTitle className="text-base font-semibold">My Account Summary</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <ImagePlaceholder type="avatar" className="h-14 w-14 border-2 border-purple-500" />
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">Juan Dela Cruz Jr.</h4>
                <p className="text-xs text-slate-500 font-mono">Student ID: 2024-0001 • Grade 10 - A</p>
              </div>
            </div>

            <Link href="/student/account">
              <Button variant="outline" className="text-xs h-9">
                <span>View Full Account Details</span>
                <ChevronRight className="h-4 w-4 ml-1 text-slate-400" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
